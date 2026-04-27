/**
 * Tests for POST /api/upload and POST /api/upload/nft-metadata.
 *
 * Pinata is mocked so no real API credentials are needed.
 */

import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"

// ---------------------------------------------------------------------------
// Mock pinata.service BEFORE importing the router so the controller gets the
// mock, not the real Pinata client.
// ---------------------------------------------------------------------------

jest.mock("../services/pinata.service", () => ({
	pinFileToIPFS: jest.fn().mockResolvedValue("bafybeifake123"),
	pinJsonToIPFS: jest.fn().mockResolvedValue("bafybeifakejson456"),
	getGatewayUrl: jest.fn(
		(cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`,
	),
}))

import { errorHandler } from "../middleware/error.middleware"
import { createUploadRouter } from "../routes/upload.routes"
import * as pinataService from "../services/pinata.service"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JWT_SECRET = "learnvault-secret"

const testJwtService = {
	signWalletToken: (addr: string) => jwt.sign({ sub: addr }, JWT_SECRET),
	verifyWalletToken: async (token: string) => {
		const d = jwt.verify(token, JWT_SECRET) as {
			sub?: string
			address?: string
		}
		const sub = d.sub ?? d.address ?? ""
		if (!sub) throw new Error("Invalid token")
		return { sub }
	},
	revokeToken: async () => {},
}

function makeToken(address = "GUSER123") {
	return jwt.sign({ address }, JWT_SECRET, { expiresIn: "1h" })
}

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", createUploadRouter(testJwtService))
	app.use(errorHandler)
	return app
}

const VALID_PDF = Buffer.from("%PDF-1.4 fake pdf content")
const VALID_PNG = Buffer.from("\x89PNG\r\n\x1a\n fake png")

// ---------------------------------------------------------------------------
// POST /api/upload
// ---------------------------------------------------------------------------

describe("POST /api/upload", () => {
	beforeEach(() => jest.clearAllMocks())

	it("returns 401 when no token is provided", async () => {
		const res = await request(buildApp())
			.post("/api/upload")
			.attach("file", VALID_PDF, {
				filename: "doc.pdf",
				contentType: "application/pdf",
			})

		expect(res.status).toBe(401)
	})

	it("returns 400 when no file is attached", async () => {
		const res = await request(buildApp())
			.post("/api/upload")
			.set("Authorization", `Bearer ${makeToken()}`)

		expect(res.status).toBe(400)
		expect(res.body).toHaveProperty("message")
	})

	it("returns 400 for a disallowed MIME type", async () => {
		const res = await request(buildApp())
			.post("/api/upload")
			.set("Authorization", `Bearer ${makeToken()}`)
			.attach("file", Buffer.from("<svg/>"), {
				filename: "evil.svg",
				contentType: "image/svg+xml",
			})

		expect(res.status).toBe(400)
	})

	it("pins a PDF and returns cid + gatewayUrl", async () => {
		const res = await request(buildApp())
			.post("/api/upload")
			.set("Authorization", `Bearer ${makeToken()}`)
			.attach("file", VALID_PDF, {
				filename: "proposal.pdf",
				contentType: "application/pdf",
			})

		expect(res.status).toBe(201)
		expect(res.body.cid).toBe("bafybeifake123")
		expect(res.body.gatewayUrl).toBe(
			"https://gateway.pinata.cloud/ipfs/bafybeifake123",
		)

		expect(pinataService.pinFileToIPFS).toHaveBeenCalledWith(
			expect.any(Buffer),
			"proposal.pdf",
		)
	})

	it("pins a PNG and returns cid + gatewayUrl", async () => {
		const res = await request(buildApp())
			.post("/api/upload")
			.set("Authorization", `Bearer ${makeToken()}`)
			.attach("file", VALID_PNG, {
				filename: "cover.png",
				contentType: "image/png",
			})

		expect(res.status).toBe(201)
		expect(res.body.cid).toBe("bafybeifake123")
	})

	it("returns 500 when Pinata throws", async () => {
		;(pinataService.pinFileToIPFS as jest.Mock).mockRejectedValueOnce(
			new Error("Pinata API error"),
		)

		const res = await request(buildApp())
			.post("/api/upload")
			.set("Authorization", `Bearer ${makeToken()}`)
			.attach("file", VALID_PDF, {
				filename: "doc.pdf",
				contentType: "application/pdf",
			})

		expect(res.status).toBe(500)
	})
})

// ---------------------------------------------------------------------------
// POST /api/upload/nft-metadata
// ---------------------------------------------------------------------------

describe("POST /api/upload/nft-metadata", () => {
	beforeEach(() => jest.clearAllMocks())

	it("returns 401 when no token is provided", async () => {
		const res = await request(buildApp())
			.post("/api/upload/nft-metadata")
			.send({ name: "Test", description: "Desc", image: "bafybeifake123" })

		expect(res.status).toBe(401)
	})

	it("returns 400 when required fields are missing", async () => {
		const res = await request(buildApp())
			.post("/api/upload/nft-metadata")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({ name: "Test" }) // missing description + image

		expect(res.status).toBe(400)
	})

	it("pins metadata and returns cid, gatewayUrl, tokenUri", async () => {
		const res = await request(buildApp())
			.post("/api/upload/nft-metadata")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({
				name: "LearnVault Scholar",
				description: "Completed Web3 Foundations",
				image: "bafybeifake123",
				attributes: [{ trait_type: "Course", value: "Web3 Foundations" }],
			})

		expect(res.status).toBe(201)
		expect(res.body.cid).toBe("bafybeifakejson456")
		expect(res.body.tokenUri).toBe("ipfs://bafybeifakejson456")
		expect(res.body.gatewayUrl).toContain("bafybeifakejson456")

		// Image CID should be normalised to an ipfs:// URI in the pinned JSON
		const pinCall = (pinataService.pinJsonToIPFS as jest.Mock).mock.calls[0]
		expect(pinCall[0].image).toBe("ipfs://bafybeifake123")
		expect(pinCall[0].attributes).toHaveLength(1)
	})

	it("normalises a bare CID image to ipfs:// URI", async () => {
		await request(buildApp())
			.post("/api/upload/nft-metadata")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({
				name: "Scholar NFT",
				description: "Proof of completion",
				image: "bafybeifake123", // no ipfs:// prefix
			})

		const pinCall = (pinataService.pinJsonToIPFS as jest.Mock).mock.calls[0]
		expect(pinCall[0].image).toBe("ipfs://bafybeifake123")
	})

	it("passes through an already-prefixed ipfs:// image URI unchanged", async () => {
		await request(buildApp())
			.post("/api/upload/nft-metadata")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({
				name: "Scholar NFT",
				description: "Proof of completion",
				image: "ipfs://bafybeifake123",
			})

		const pinCall = (pinataService.pinJsonToIPFS as jest.Mock).mock.calls[0]
		expect(pinCall[0].image).toBe("ipfs://bafybeifake123")
	})
})
