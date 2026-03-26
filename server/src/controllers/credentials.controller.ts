import { type Request, type Response } from "express"
import fs from "fs/promises"
import path from "path"

import { pinJsonToIPFS, getGatewayUrl } from "../services/pinata.service"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CourseMetadata {
	id: string
	title: string
	difficulty: string
}

interface NFTAttribute {
	trait_type: string
	value: string
}

interface NFTMetadata {
	name: string
	description: string
	image: string
	attributes: NFTAttribute[]
}

interface CreateMetadataRequest {
	course_id: string
	learner_address: string
	completed_at: string
}

// ---------------------------------------------------------------------------
// Course Data
// ---------------------------------------------------------------------------

let coursesCache: CourseMetadata[] | null = null

async function loadCourses(): Promise<CourseMetadata[]> {
	if (coursesCache) return coursesCache

	const coursesPath = path.resolve(
		__dirname,
		"../../content/courses/index.json",
	)
	const coursesData = await fs.readFile(coursesPath, "utf-8")
	const courses = JSON.parse(coursesData) as Array<{
		id: string
		title: string
		difficulty: string
	}>

	coursesCache = courses.map((c) => ({
		id: c.id,
		title: c.title,
		difficulty: c.difficulty,
	}))

	return coursesCache
}

// ---------------------------------------------------------------------------
// Image Mapping
// ---------------------------------------------------------------------------

const COURSE_IMAGE_MAP: Record<string, string> = {
	"stellar-basics": "scholar-nft-stellar.png",
	"soroban-fundamentals": "scholar-nft-soroban.png",
	"soroban-contracts": "scholar-nft-soroban.png",
	"defi-fundamentals": "scholar-nft-defi.png",
}

const DEFAULT_IMAGE = "scholar-nft-base.png"

// Placeholder IPFS CIDs for badge images
// In production, these should be uploaded to IPFS and the CIDs stored in config
const IMAGE_CID_MAP: Record<string, string> = {
	"scholar-nft-stellar.png":
		"bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
	"scholar-nft-soroban.png":
		"bafybeihvvlkvjkbxy6qxzjzqxzqxzqxzqxzqxzqxzqxzqxzqxzqxzqxzqx",
	"scholar-nft-defi.png":
		"bafybeidefi123456789abcdefghijklmnopqrstuvwxyz1234567890abc",
	"scholar-nft-base.png":
		"bafybeiabc123456789defghijklmnopqrstuvwxyz1234567890abcdef",
}

function getImageCID(courseId: string): string {
	const imageName = COURSE_IMAGE_MAP[courseId] || DEFAULT_IMAGE
	return IMAGE_CID_MAP[imageName] || IMAGE_CID_MAP[DEFAULT_IMAGE]
}

// ---------------------------------------------------------------------------
// Metadata Generation
// ---------------------------------------------------------------------------

function generateMetadata(
	course: CourseMetadata,
	learnerAddress: string,
	completedAt: string,
): NFTMetadata {
	const imageCID = getImageCID(course.id)

	return {
		name: `${course.title} — Course Completion`,
		description: `Issued to learners who complete all milestones in ${course.title}`,
		image: `ipfs://${imageCID}`,
		attributes: [
			{
				trait_type: "Course",
				value: course.id,
			},
			{
				trait_type: "Course Title",
				value: course.title,
			},
			{
				trait_type: "Completed At",
				value: completedAt,
			},
			{
				trait_type: "Learner",
				value: learnerAddress,
			},
			{
				trait_type: "Difficulty",
				value: course.difficulty,
			},
		],
	}
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * POST /api/credentials/metadata
 *
 * Generate NFT metadata for a course completion credential and upload to IPFS.
 * Returns the ipfs:// URI for use in scholar_nft.mint().
 */
export async function createCredentialMetadata(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const { course_id, learner_address, completed_at } =
			req.body as CreateMetadataRequest

		// Load course data
		const courses = await loadCourses()
		const course = courses.find((c) => c.id === course_id)

		if (!course) {
			res.status(404).json({
				error: "Course not found",
				message: `No course found with id: ${course_id}`,
			})
			return
		}

		// Generate metadata
		const metadata = generateMetadata(course, learner_address, completed_at)

		// Upload to IPFS via Pinata
		const metadataName = `${course_id}-${learner_address}-${Date.now()}`
		const cid = await pinJsonToIPFS(metadata, metadataName)

		// Build response
		const metadataUri = `ipfs://${cid}`
		const gatewayUrl = getGatewayUrl(cid)

		res.status(201).json({
			data: {
				metadata_uri: metadataUri,
				gateway_url: gatewayUrl,
				metadata,
			},
		})
	} catch (error) {
		console.error("Error creating credential metadata:", error)

		if (
			error instanceof Error &&
			error.message.includes("Pinata is not configured")
		) {
			res.status(503).json({
				error: "Service unavailable",
				message:
					"IPFS pinning service is not configured. Please contact the administrator.",
			})
			return
		}

		res.status(500).json({
			error: "Internal server error",
			message: "Failed to create credential metadata",
		})
	}
}
