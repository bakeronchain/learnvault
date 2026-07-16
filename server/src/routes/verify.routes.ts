import fs from "fs/promises"
import { createHmac } from "node:crypto"
import path from "path"
import { Router, type Request, type Response } from "express"
import { pool } from "../db/index"
import { logger } from "../lib/logger"
import { getRpcCache, CacheKey } from "../lib/rpc-cache"
import { stellarContractService } from "../services/stellar-contract.service"

const log = logger.child({ module: "verify" })
const router = Router()

interface CourseMetadata {
	id: string
	title: string
}

let coursesCache: CourseMetadata[] | null = null

async function loadCourses(): Promise<CourseMetadata[]> {
	if (coursesCache) return coursesCache
	try {
		const coursesPath = path.resolve(
			process.cwd(),
			"content/courses/index.json",
		)
		const coursesData = await fs.readFile(coursesPath, "utf-8")
		const courses = JSON.parse(coursesData) as Array<{
			id: string
			title: string
		}>
		coursesCache = courses.map((c) => ({
			id: c.id,
			title: c.title,
		}))
		return coursesCache
	} catch (err) {
		log.error({ err }, "Failed to load courses index for verification")
		return []
	}
}

function getVerificationSecret(): string {
	return (
		process.env.CREDENTIAL_SECRET ||
		process.env.EMAIL_VERIFICATION_SECRET ||
		process.env.WEBHOOK_SECRET ||
		"dev_credential_verification_secret_key"
	)
}

function signCredentialPayload(payload: {
	token_id: number
	learner_address: string
	course: { id: string; title: string }
	issued_at: string
	valid: boolean
}): string {
	const secret = getVerificationSecret()
	const data = `${payload.token_id}:${payload.learner_address}:${payload.course.id}:${payload.issued_at}:${payload.valid}`
	return createHmac("sha256", secret).update(data).digest("hex")
}

function signAddressPayload(address: string, credentials: any[]): string {
	const secret = getVerificationSecret()
	const tokenIds = credentials
		.map((c) => c.token_id)
		.sort((a, b) => a - b)
		.join(",")
	const data = `${address}:${tokenIds}`
	return createHmac("sha256", secret).update(data).digest("hex")
}

async function resolveCredentialVerification(tokenId: number): Promise<{
	valid: boolean
	learner_address: string
	course: { id: string; title: string }
	issued_at: string
	token_id: number
	tx_hash: string
	signature: string
}> {
	const cache = getRpcCache()
	const cacheKey = CacheKey.verifyCredential(tokenId)

	// 1. Check cache first
	const cached = await cache.get(cacheKey)
	if (cached) {
		return JSON.parse(cached)
	}

	// 2. Query DB
	const dbResult = await pool.query(
		`SELECT scholar_address, course_id, metadata_uri, minted_at, revoked
		 FROM scholar_nfts
		 WHERE token_id = $1`,
		[tokenId],
	)

	if (dbResult.rows.length === 0) {
		const payload = {
			valid: false,
			learner_address: "",
			course: { id: "", title: "" },
			issued_at: "",
			token_id: tokenId,
			tx_hash: "",
			signature: "",
		}
		payload.signature = signCredentialPayload(payload)
		return payload
	}

	const row = dbResult.rows[0]
	const courseId = row.course_id
	const scholarAddress = row.scholar_address
	const dbIssuedAt = row.minted_at ? new Date(row.minted_at).toISOString() : ""
	const dbRevoked = Boolean(row.revoked)

	// 3. Resolve course title
	const courses = await loadCourses()
	const courseInfo = courses.find((c) => c.id === courseId) || {
		id: courseId,
		title: "Unknown Course",
	}

	// 4. Query tx_hash from events
	const eventResult = await pool.query(
		`SELECT tx_hash
		 FROM events
		 WHERE event_type = 'ScholarNFT::minted'
		   AND data->'value'->>'token_id' = $1::text`,
		[String(tokenId)],
	)
	const txHash = eventResult.rows[0]?.tx_hash || ""

	// 5. Query contract state directly for on-chain proof
	const onChain = await stellarContractService.getScholarNftOnChain(tokenId)

	const learnerAddress = onChain.owner || scholarAddress
	const issuedAt = onChain.issuedAt || dbIssuedAt
	const contractConfigured = Boolean(process.env.SCHOLAR_NFT_CONTRACT_ID)
	let valid = !dbRevoked && !onChain.revoked
	if (contractConfigured && !onChain.owner) {
		valid = false
	}

	const payload = {
		valid,
		learner_address: learnerAddress,
		course: {
			id: courseInfo.id,
			title: courseInfo.title,
		},
		issued_at: issuedAt,
		token_id: tokenId,
		tx_hash: txHash,
		signature: "",
	}

	payload.signature = signCredentialPayload(payload)

	// Cache for 30 days
	await cache.set(cacheKey, JSON.stringify(payload), 2592000)

	return payload
}

/**
 * GET /api/verify/credentials/:id
 * Resolves credential status on-chain + DB, returns a signed verification record.
 */
router.get(
	"/verify/credentials/:id",
	async (req: Request, res: Response): Promise<void> => {
		const tokenId = Number(req.params.id)
		if (isNaN(tokenId) || tokenId <= 0) {
			res.status(400).json({ error: "Invalid token ID" })
			return
		}
		try {
			const payload = await resolveCredentialVerification(tokenId)
			res.status(200).json(payload)
		} catch (err) {
			log.error({ err, tokenId }, "Error resolving verify credential")
			res.status(500).json({ error: "Internal server error" })
		}
	},
)

/**
 * GET /api/verify/address/:address
 * Lists all valid credentials for a wallet address, returns a signed payload.
 */
router.get(
	"/verify/address/:address",
	async (req: Request, res: Response): Promise<void> => {
		const { address } = req.params
		if (!address) {
			res.status(400).json({ error: "Address is required" })
			return
		}

		const cache = getRpcCache()
		const cacheKey = CacheKey.verifyAddress(address)

		try {
			const cached = await cache.get(cacheKey)
			if (cached) {
				res.status(200).json(JSON.parse(cached))
				return
			}

			// Find all token IDs belonging to this address (that are not revoked in DB)
			const dbResult = await pool.query(
				`SELECT token_id
			 FROM scholar_nfts
			 WHERE scholar_address = $1 AND revoked = false
			 ORDER BY token_id ASC`,
				[address],
			)

			const resolvedList: any[] = []
			for (const row of dbResult.rows) {
				const tokenId = Number(row.token_id)
				const cred = await resolveCredentialVerification(tokenId)
				if (cred.valid) {
					resolvedList.push(cred)
				}
			}

			const payload = {
				address,
				credentials: resolvedList,
				signature: signAddressPayload(address, resolvedList),
			}

			// Cache for 30 days
			await cache.set(cacheKey, JSON.stringify(payload), 2592000)

			res.status(200).json(payload)
		} catch (err) {
			log.error({ err, address }, "Error resolving verify address")
			res.status(500).json({ error: "Internal server error" })
		}
	},
)

export { router as verifyRouter }
