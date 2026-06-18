import dotenv from "dotenv"
import path from "path"

// Resolve the path relative to process.cwd() assuming we run from server/ folder
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import fs from "fs"
import { pinFileToIPFS } from "../src/services/pinata.service"

const images = [
	"scholar-nft-stellar.png",
	"scholar-nft-soroban.png",
	"scholar-nft-defi.png",
	"scholar-nft-base.png",
]

async function uploadImages() {
	const cidMap: Record<string, string> = {}

	for (const imageName of images) {
		const imagePath = path.resolve(
			process.cwd(),
			"..",
			"public",
			"assets",
			"brand",
			"nft",
			imageName,
		)
		const buffer = fs.readFileSync(imagePath)

		console.log(`Uploading ${imageName}...`)
		const cid = await pinFileToIPFS(buffer, imageName)
		cidMap[imageName] = cid
		console.log(`✓ ${imageName}: ipfs://${cid}`)
	}

	console.log("\nUpdate IMAGE_CID_MAP in credentials.controller.ts with these CIDs:")
	console.log(JSON.stringify(cidMap, null, 2))
}

uploadImages().catch(console.error)
