# TODO: Upload NFT Badge Images to IPFS

## Current Status

The NFT metadata generation endpoint is functional, but uses placeholder IPFS
CIDs for badge images.

## Action Required

Upload the following badge images to IPFS and update the `IMAGE_CID_MAP` in
`server/src/controllers/credentials.controller.ts`:

### Images to Upload

Located in `/public/assets/brand/nft/`:

1. `scholar-nft-stellar.png` - Stellar Basics course badge
2. `scholar-nft-soroban.png` - Soroban courses badge
3. `scholar-nft-defi.png` - DeFi Fundamentals course badge
4. `scholar-nft-base.png` - Generic/fallback badge

### Upload Process

#### Option 1: Using Pinata Web Interface

1. Go to https://app.pinata.cloud/pinmanager
2. Click "Upload" → "File"
3. Upload each PNG file
4. Copy the CID for each file
5. Update `IMAGE_CID_MAP` in the controller

#### Option 2: Using Pinata API

```bash
# Upload a single image
curl -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
  -H "pinata_api_key: YOUR_API_KEY" \
  -H "pinata_secret_api_key: YOUR_SECRET_KEY" \
  -F "file=@public/assets/brand/nft/scholar-nft-stellar.png" \
  -F 'pinataMetadata={"name":"scholar-nft-stellar.png"}' \
  -F 'pinataOptions={"cidVersion": 1}'
```

#### Option 3: Using the Upload Script

Create a script to automate the upload:

```typescript
// scripts/upload-nft-images.ts
import fs from "fs"
import path from "path"
import { pinFileToIPFS } from "../server/src/services/pinata.service"

const images = [
	"scholar-nft-stellar.png",
	"scholar-nft-soroban.png",
	"scholar-nft-defi.png",
	"scholar-nft-base.png",
]

async function uploadImages() {
	const cidMap: Record<string, string> = {}

	for (const imageName of images) {
		const imagePath = path.join(
			__dirname,
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

	console.log("\nUpdate IMAGE_CID_MAP in credentials.controller.ts:")
	console.log(JSON.stringify(cidMap, null, 2))
}

uploadImages().catch(console.error)
```

Run with:

```bash
cd server
npx ts-node ../scripts/upload-nft-images.ts
```

### Update the Controller

After uploading, update the `IMAGE_CID_MAP` constant in
`server/src/controllers/credentials.controller.ts`:

```typescript
const IMAGE_CID_MAP: Record<string, string> = {
	"scholar-nft-stellar.png": "bafybeiabc123...", // Replace with actual CID
	"scholar-nft-soroban.png": "bafybeiabc456...", // Replace with actual CID
	"scholar-nft-defi.png": "bafybeiabc789...", // Replace with actual CID
	"scholar-nft-base.png": "bafybeiabc000...", // Replace with actual CID
}
```

## Verification

After updating the CIDs, verify the images are accessible:

```bash
# Test each image URL
curl -I https://gateway.pinata.cloud/ipfs/YOUR_CID

# Or visit in browser
open https://gateway.pinata.cloud/ipfs/YOUR_CID
```

## Notes

- Use CIDv1 for better compatibility
- Images should be 1000x1000px PNG format
- Consider using a dedicated Pinata gateway for production
- Keep a backup of the CIDs in case the controller file is modified
