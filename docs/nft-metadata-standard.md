# ScholarNFT Metadata Standard

## Overview

ScholarNFT credentials follow the ERC-721/ERC-1155 metadata standard to ensure compatibility with NFT marketplaces, wallets, and tooling across the ecosystem.

## Metadata Schema

Each ScholarNFT credential includes a JSON metadata file stored on IPFS with the following structure:

```json
{
  "name": "string",
  "description": "string",
  "image": "ipfs://...",
  "attributes": [
    {
      "trait_type": "string",
      "value": "string"
    }
  ]
}
```

### Fields

- `name` (required): Human-readable credential title
  - Format: `"{Course Title} — Course Completion"`
  - Example: `"Introduction to Stellar & Soroban — Course Completion"`

- `description` (required): Detailed description of the credential
  - Format: `"Issued to learners who complete all milestones in {course_title}"`
  - Example: `"Issued to learners who complete all milestones in Introduction to Stellar & Soroban"`

- `image` (required): IPFS URI pointing to the credential badge image
  - Format: `"ipfs://{CID}"`
  - Example: `"ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"`

- `attributes` (required): Array of trait objects describing the credential
  - Each trait has `trait_type` and `value` fields
  - Standard traits:
    - `Course`: The course ID (e.g., `"stellar-basics"`)
    - `Course Title`: The full course title
    - `Completed At`: ISO 8601 timestamp of completion
    - `Learner`: Stellar address of the credential holder
    - `Difficulty`: Course difficulty level (beginner, intermediate, advanced)

## Example Metadata

### Stellar Basics Completion

```json
{
  "name": "Introduction to Stellar & Soroban — Course Completion",
  "description": "Issued to learners who complete all milestones in Introduction to Stellar & Soroban",
  "image": "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  "attributes": [
    {
      "trait_type": "Course",
      "value": "stellar-basics"
    },
    {
      "trait_type": "Course Title",
      "value": "Introduction to Stellar & Soroban"
    },
    {
      "trait_type": "Completed At",
      "value": "2026-03-26T10:30:00Z"
    },
    {
      "trait_type": "Learner",
      "value": "GABC123...XYZ789"
    },
    {
      "trait_type": "Difficulty",
      "value": "beginner"
    }
  ]
}
```

### DeFi Fundamentals Completion

```json
{
  "name": "DeFi Fundamentals on Stellar — Course Completion",
  "description": "Issued to learners who complete all milestones in DeFi Fundamentals on Stellar",
  "image": "ipfs://bafkreiabcdef1234567890ghijklmnopqrstuvwxyz",
  "attributes": [
    {
      "trait_type": "Course",
      "value": "defi-fundamentals"
    },
    {
      "trait_type": "Course Title",
      "value": "DeFi Fundamentals on Stellar"
    },
    {
      "trait_type": "Completed At",
      "value": "2026-03-15T14:22:00Z"
    },
    {
      "trait_type": "Learner",
      "value": "GDEF456...ABC123"
    },
    {
      "trait_type": "Difficulty",
      "value": "intermediate"
    }
  ]
}
```

## API Integration

### Generating Metadata

Use the `POST /api/credentials/metadata` endpoint to generate and upload metadata:

```bash
curl -X POST https://api.learnvault.xyz/api/credentials/metadata \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "course_id": "stellar-basics",
    "learner_address": "GABC123...XYZ789",
    "completed_at": "2026-03-26T10:30:00Z"
  }'
```

Response:

```json
{
  "data": {
    "metadata_uri": "ipfs://bafkreiabcdef1234567890ghijklmnopqrstuvwxyz",
    "gateway_url": "https://gateway.pinata.cloud/ipfs/bafkreiabcdef1234567890ghijklmnopqrstuvwxyz",
    "metadata": {
      "name": "Introduction to Stellar & Soroban — Course Completion",
      "description": "Issued to learners who complete all milestones in Introduction to Stellar & Soroban",
      "image": "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      "attributes": [...]
    }
  }
}
```

### Minting with Metadata

After generating metadata, use the returned `metadata_uri` when calling `scholar_nft.mint()`:

```typescript
import { scholarNftContract } from './contracts';

const metadataUri = "ipfs://bafkreiabcdef1234567890ghijklmnopqrstuvwxyz";
const learnerAddress = "GABC123...XYZ789";

const tokenId = await scholarNftContract.mint({
  to: learnerAddress,
  metadata_uri: metadataUri
});
```

## Image Assets

Course completion badge images are stored in `/public/assets/brand/nft/` and follow this naming convention:

- `scholar-nft-{course-slug}.svg` - Vector source
- `scholar-nft-{course-slug}.png` - Rasterized version (1000x1000px)

Available badges:
- `scholar-nft-base.png` - Generic completion badge
- `scholar-nft-stellar.png` - Stellar Basics course
- `scholar-nft-soroban.png` - Soroban Contracts course
- `scholar-nft-defi.png` - DeFi Fundamentals course

## IPFS Pinning

Metadata is pinned to IPFS via Pinata to ensure permanent availability. The service:

1. Generates metadata JSON conforming to this standard
2. Pins the JSON to IPFS using Pinata
3. Returns both the `ipfs://` URI and HTTP gateway URL
4. Uses CIDv1 for future-proof addressing

## Compatibility

This standard ensures ScholarNFT credentials are compatible with:

- OpenSea and other NFT marketplaces
- Wallet applications (Freighter, Lobstr, etc.)
- NFT aggregators and analytics platforms
- IPFS gateways and pinning services
- Standard NFT tooling and libraries

## References

- [ERC-721 Metadata Standard](https://eips.ethereum.org/EIPS/eip-721)
- [ERC-1155 Metadata Standard](https://eips.ethereum.org/EIPS/eip-1155)
- [OpenSea Metadata Standards](https://docs.opensea.io/docs/metadata-standards)
- [IPFS Content Addressing](https://docs.ipfs.tech/concepts/content-addressing/)
