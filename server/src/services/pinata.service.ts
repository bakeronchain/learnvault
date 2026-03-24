import PinataClient from "@pinata/sdk";
import { Readable } from "stream";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function createClient(): PinataClient | null {
  const apiKey = process.env.PINATA_API_KEY;
  const secret = process.env.PINATA_SECRET;
  if (!apiKey || !secret) return null;
  return new PinataClient(apiKey, secret);
}

// Lazily created so the service can be imported even when env vars are absent
// (e.g. in tests that stub the module).
let _client: PinataClient | null | undefined;
function getClient(): PinataClient {
  if (_client === undefined) _client = createClient();
  if (!_client) {
    throw new Error(
      "Pinata is not configured. Set PINATA_API_KEY and PINATA_SECRET in server/.env",
    );
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pin a file buffer to IPFS via Pinata.
 * Returns the IPFS CIDv1.
 */
export async function pinFileToIPFS(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const client = getClient();

  // @pinata/sdk requires a Readable stream with a `path` property so it can
  // infer the filename when building the multipart request.
  const stream = Readable.from(buffer) as Readable & { path: string };
  stream.path = filename;

  const result = await client.pinFileToIPFS(stream, {
    pinataMetadata: { name: filename },
    pinataOptions: { cidVersion: 1 },
  });

  return result.IpfsHash;
}

/**
 * Pin a JSON object to IPFS via Pinata.
 * Intended for ScholarNFT metadata conforming to ERC-721 / ERC-1155 metadata
 * standard (name, description, image, attributes).
 * Returns the IPFS CIDv1.
 */
export async function pinJsonToIPFS(
  json: Record<string, unknown>,
  name: string,
): Promise<string> {
  const client = getClient();

  const result = await client.pinJSONToIPFS(json, {
    pinataMetadata: { name },
    pinataOptions: { cidVersion: 1 },
  });

  return result.IpfsHash;
}

/**
 * Build a public HTTP URL for a CID using the configured gateway.
 * Defaults to the Pinata dedicated gateway; override with IPFS_GATEWAY_URL.
 */
export function getGatewayUrl(cid: string): string {
  const base =
    process.env.IPFS_GATEWAY_URL?.replace(/\/$/, "") ??
    "https://gateway.pinata.cloud/ipfs";
  return `${base}/${cid}`;
}
