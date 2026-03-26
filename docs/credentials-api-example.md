# Credentials API Usage Example

## Overview

This guide demonstrates how to use the `/api/credentials/metadata` endpoint to generate NFT metadata and mint ScholarNFT credentials.

## Prerequisites

- Pinata API credentials configured in `server/.env`:
  ```env
  PINATA_API_KEY=your_pinata_api_key
  PINATA_SECRET=your_pinata_secret_api_key
  ```

- Valid JWT token for authentication

## Step 1: Generate Metadata

Call the endpoint to generate and upload metadata to IPFS:

```bash
curl -X POST http://localhost:4000/api/credentials/metadata \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "course_id": "stellar-basics",
    "learner_address": "GABC123DEFGHIJKLMNOPQRSTUVWXYZ456789",
    "completed_at": "2026-03-26T10:30:00Z"
  }'
```

### Response

```json
{
  "data": {
    "metadata_uri": "ipfs://bafkreiabcdef1234567890ghijklmnopqrstuvwxyz",
    "gateway_url": "https://gateway.pinata.cloud/ipfs/bafkreiabcdef1234567890ghijklmnopqrstuvwxyz",
    "metadata": {
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
          "value": "GABC123DEFGHIJKLMNOPQRSTUVWXYZ456789"
        },
        {
          "trait_type": "Difficulty",
          "value": "beginner"
        }
      ]
    }
  }
}
```

## Step 2: Mint the NFT

Use the returned `metadata_uri` to mint the ScholarNFT:

```typescript
import { Contract, SorobanRpc } from '@stellar/stellar-sdk';

// Initialize contract
const rpcUrl = 'https://soroban-testnet.stellar.org';
const server = new SorobanRpc.Server(rpcUrl);
const contractId = 'CSCHOLAR_NFT_CONTRACT_ID';

// Mint the credential
const metadataUri = "ipfs://bafkreiabcdef1234567890ghijklmnopqrstuvwxyz";
const learnerAddress = "GABC123DEFGHIJKLMNOPQRSTUVWXYZ456789";

const contract = new Contract(contractId);
const tx = contract.call(
  'mint',
  learnerAddress,
  metadataUri
);

// Sign and submit transaction
// ... (transaction signing and submission code)
```

## Step 3: Verify the Metadata

You can view the metadata via the HTTP gateway:

```bash
curl https://gateway.pinata.cloud/ipfs/bafkreiabcdef1234567890ghijklmnopqrstuvwxyz
```

## Available Courses

The following course IDs are supported:

- `stellar-basics` - Introduction to Stellar & Soroban
- `soroban-fundamentals` - Soroban Fundamentals
- `soroban-contracts` - Soroban Smart Contract Development
- `defi-fundamentals` - DeFi Fundamentals on Stellar

## Error Handling

### Course Not Found (404)

```json
{
  "error": "Course not found",
  "message": "No course found with id: invalid-course"
}
```

### Service Unavailable (503)

```json
{
  "error": "Service unavailable",
  "message": "IPFS pinning service is not configured. Please contact the administrator."
}
```

### Validation Error (400)

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "completed_at",
      "message": "completed_at must be a valid ISO 8601 datetime"
    }
  ]
}
```

## Integration with Frontend

Example React/TypeScript integration:

```typescript
interface CreateMetadataRequest {
  course_id: string;
  learner_address: string;
  completed_at: string;
}

interface MetadataResponse {
  data: {
    metadata_uri: string;
    gateway_url: string;
    metadata: {
      name: string;
      description: string;
      image: string;
      attributes: Array<{
        trait_type: string;
        value: string;
      }>;
    };
  };
}

async function generateCredentialMetadata(
  courseId: string,
  learnerAddress: string,
  completedAt: Date
): Promise<MetadataResponse> {
  const response = await fetch('/api/credentials/metadata', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({
      course_id: courseId,
      learner_address: learnerAddress,
      completed_at: completedAt.toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate metadata: ${response.statusText}`);
  }

  return response.json();
}

// Usage
const metadata = await generateCredentialMetadata(
  'stellar-basics',
  'GABC123...',
  new Date()
);

console.log('Metadata URI:', metadata.data.metadata_uri);
console.log('View at:', metadata.data.gateway_url);
```

## Notes

- The `completed_at` timestamp must be in ISO 8601 format (e.g., `2026-03-26T10:30:00Z`)
- The learner address must be a valid Stellar address (G... format)
- Metadata is permanently pinned to IPFS via Pinata
- The endpoint requires authentication via JWT token
- Badge images are pre-uploaded to IPFS (CIDs are hardcoded in the controller)

## Next Steps

1. Upload actual badge images to IPFS and update the `IMAGE_CID_MAP` in `credentials.controller.ts`
2. Add authentication middleware to restrict who can generate metadata
3. Consider adding rate limiting to prevent abuse
4. Add database logging to track metadata generation
5. Implement webhook notifications when credentials are minted
