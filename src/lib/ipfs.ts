const DEFAULT_GATEWAY = "https://gateway.pinata.cloud/ipfs";

/**
 * Build a public HTTP URL for an IPFS CID.
 *
 * Uses the optional VITE_IPFS_GATEWAY_URL env var so teams with a dedicated
 * Pinata gateway can swap it in without changing component code.
 */
export function getIpfsUrl(cid: string): string {
  const base =
    (import.meta.env.VITE_IPFS_GATEWAY_URL as string | undefined)?.replace(
      /\/$/,
      "",
    ) ?? DEFAULT_GATEWAY;
  return `${base}/${cid}`;
}

/**
 * Returns true if the string looks like a bare CIDv0 (Qm…) or CIDv1 (bafy…).
 * Useful for conditional rendering of IPFS previews.
 */
export function isCid(value: string): boolean {
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{52,})/.test(value);
}

/**
 * Strips an ipfs:// prefix and returns the bare CID, or passes the value
 * through unchanged if it is already a bare CID or a gateway URL.
 */
export function normaliseCid(value: string): string {
  if (value.startsWith("ipfs://")) return value.slice("ipfs://".length);
  return value;
}
