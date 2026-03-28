import { useQuery } from "@tanstack/react-query"
import { Contract, rpc, xdr } from "@stellar/stellar-sdk"
import { networkPassphrase, rpcUrl } from "../contracts/util"
import { CONTRACT_IDS } from "../constants/contracts"
import { getIpfsUrl, normaliseCid, isCid } from "../lib/ipfs"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NftMetadataJson {
    name?: string
    programName?: string
    description?: string
    image?: string
    completionDate?: string
    scholarName?: string
    issuer?: string
    reputationPoints?: string
    attributes?: Array<{ trait_type: string; value: string }>
}

export interface CredentialData {
    id: string
    owner: string
    metadataUri: string
    isRevoked: boolean
    revocationReason?: string
    issuedAt?: number
    /** Fields resolved from the IPFS metadata JSON */
    programName: string
    scholarName: string
    completionDate: string
    artworkUrl: string
    issuer: string
    reputationPoints: string
    txHash: string
}

type FetchStatus = "loading" | "success" | "not_found" | "revoked" | "error"

export interface UseScholarNftResult {
    credential: CredentialData | null
    status: FetchStatus
    error: string | null
}

// ---------------------------------------------------------------------------
// Low-level Soroban helpers (read-only simulation, no signing needed)
// ---------------------------------------------------------------------------

function buildServer(): rpc.Server {
    return new rpc.Server(rpcUrl, { allowHttp: true })
}

async function simulateCall(
    contractId: string,
    methodName: string,
    ...args: xdr.ScVal[]
): Promise<xdr.ScVal | null> {
    const server = buildServer()
    const contract = new Contract(contractId)
    const operation = contract.call(methodName, ...args)

    // We need a source account for the simulated tx — use a throwaway one.
    const { Keypair, TransactionBuilder, BASE_FEE, Account } = await import(
        "@stellar/stellar-sdk"
    )
    const keypair = Keypair.random()
    const source = new Account(keypair.publicKey(), "0")

    const tx = new TransactionBuilder(source, {
        fee: BASE_FEE,
        networkPassphrase,
    })
        .addOperation(operation)
        .setTimeout(30)
        .build()

    const result = await server.simulateTransaction(tx)

    if (rpc.Api.isSimulationError(result)) {
        const errMsg =
            typeof result.error === "string"
                ? result.error
                : JSON.stringify(result.error)
        throw new Error(errMsg)
    }

    return (
        (result as rpc.Api.SimulateTransactionSuccessResponse).result?.retval ??
        null
    )
}

// ---------------------------------------------------------------------------
// Contract query helpers
// ---------------------------------------------------------------------------

async function queryOwnerOf(
    contractId: string,
    tokenId: number,
): Promise<string> {
    const { scValToNative } = await import("@stellar/stellar-sdk")
    const retval = await simulateCall(
        contractId,
        "owner_of",
        xdr.ScVal.scvU64(new xdr.Uint64(tokenId)),
    )
    if (!retval) throw new Error("No return value from owner_of")
    return scValToNative(retval) as string
}

async function queryTokenUri(
    contractId: string,
    tokenId: number,
): Promise<string> {
    const { scValToNative } = await import("@stellar/stellar-sdk")
    const retval = await simulateCall(
        contractId,
        "token_uri",
        xdr.ScVal.scvU64(new xdr.Uint64(tokenId)),
    )
    if (!retval) throw new Error("No return value from token_uri")
    return scValToNative(retval) as string
}

async function queryIsRevoked(
    contractId: string,
    tokenId: number,
): Promise<boolean> {
    const { scValToNative } = await import("@stellar/stellar-sdk")
    const retval = await simulateCall(
        contractId,
        "is_revoked",
        xdr.ScVal.scvU64(new xdr.Uint64(tokenId)),
    )
    if (!retval) return false
    return scValToNative(retval) as boolean
}

async function queryRevocationReason(
    contractId: string,
    tokenId: number,
): Promise<string | undefined> {
    try {
        const { scValToNative } = await import("@stellar/stellar-sdk")
        const retval = await simulateCall(
            contractId,
            "get_revocation_reason",
            xdr.ScVal.scvU64(new xdr.Uint64(tokenId)),
        )
        if (!retval) return undefined
        const native = scValToNative(retval)
        return typeof native === "string" ? native : undefined
    } catch {
        return undefined
    }
}

async function queryGetMetadata(
    contractId: string,
    tokenId: number,
): Promise<{ owner: string; metadata_uri: string; issued_at: number } | null> {
    try {
        const { scValToNative } = await import("@stellar/stellar-sdk")
        const retval = await simulateCall(
            contractId,
            "get_metadata",
            xdr.ScVal.scvU64(new xdr.Uint64(tokenId)),
        )
        if (!retval) return null
        return scValToNative(retval) as {
            owner: string
            metadata_uri: string
            issued_at: number
        }
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// IPFS metadata fetch
// ---------------------------------------------------------------------------

function resolveMetadataUrl(uri: string): string {
    // If it's a raw CID or has ipfs:// prefix, use the gateway
    const normalised = normaliseCid(uri)
    if (isCid(normalised)) {
        return getIpfsUrl(normalised)
    }
    // If it's already an HTTP URL, use as-is
    if (uri.startsWith("http://") || uri.startsWith("https://")) {
        return uri
    }
    // Last resort — treat as CID
    return getIpfsUrl(normalised)
}

function resolveImageUrl(image: string | undefined): string {
    if (!image) return ""
    const normalised = normaliseCid(image)
    if (isCid(normalised)) return getIpfsUrl(normalised)
    if (image.startsWith("http://") || image.startsWith("https://"))
        return image
    return getIpfsUrl(normalised)
}

async function fetchIpfsMetadata(
    uri: string,
): Promise<NftMetadataJson | null> {
    try {
        const url = resolveMetadataUrl(uri)
        const response = await fetch(url)
        if (!response.ok) return null
        return (await response.json()) as NftMetadataJson
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// Attribute helpers
// ---------------------------------------------------------------------------

function findAttribute(
    metadata: NftMetadataJson,
    traitName: string,
): string | undefined {
    return metadata.attributes?.find(
        (a) => a.trait_type.toLowerCase() === traitName.toLowerCase(),
    )?.value
}

function formatTimestamp(ts: number | undefined): string {
    if (!ts) return "Unknown"
    try {
        return new Date(ts * 1000).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        })
    } catch {
        return "Unknown"
    }
}

function truncateAddress(addr: string): string {
    if (addr.length <= 12) return addr
    return `${addr.slice(0, 6)}…${addr.slice(-6)}`
}

// ---------------------------------------------------------------------------
// Core fetch function
// ---------------------------------------------------------------------------

async function fetchCredentialData(tokenId: string): Promise<CredentialData> {
    const contractId = CONTRACT_IDS.scholarNft
    if (!contractId) {
        throw new Error("Scholar NFT contract not configured")
    }

    const numericId = parseInt(tokenId, 10)
    if (isNaN(numericId) || numericId <= 0) {
        throw new Error("Invalid token ID")
    }

    // 1. Check revocation first
    const isRevoked = await queryIsRevoked(contractId, numericId)
    if (isRevoked) {
        const reason = await queryRevocationReason(contractId, numericId)
        throw Object.assign(new Error("Token revoked"), {
            code: "REVOKED" as const,
            reason,
        })
    }

    // 2. Fetch on-chain data in parallel
    const [owner, tokenUri, metadata] = await Promise.all([
        queryOwnerOf(contractId, numericId),
        queryTokenUri(contractId, numericId),
        queryGetMetadata(contractId, numericId),
    ])

    // 3. Fetch IPFS metadata
    const ipfsMeta = await fetchIpfsMetadata(
        metadata?.metadata_uri ?? tokenUri,
    )

    // 4. Build credential data
    const completionDate =
        ipfsMeta?.completionDate ??
        findAttribute(ipfsMeta ?? {}, "completion_date") ??
        findAttribute(ipfsMeta ?? {}, "completionDate") ??
        formatTimestamp(metadata?.issued_at)

    const programName =
        ipfsMeta?.programName ??
        ipfsMeta?.name ??
        findAttribute(ipfsMeta ?? {}, "program") ??
        findAttribute(ipfsMeta ?? {}, "programName") ??
        "ScholarNFT Credential"

    const scholarName =
        ipfsMeta?.scholarName ??
        findAttribute(ipfsMeta ?? {}, "scholar") ??
        findAttribute(ipfsMeta ?? {}, "scholarName") ??
        truncateAddress(owner)

    const artworkUrl = resolveImageUrl(ipfsMeta?.image)

    const issuer =
        ipfsMeta?.issuer ??
        findAttribute(ipfsMeta ?? {}, "issuer") ??
        "LearnVault DAO"

    const reputationPoints =
        ipfsMeta?.reputationPoints ??
        findAttribute(ipfsMeta ?? {}, "reputation") ??
        findAttribute(ipfsMeta ?? {}, "reputationPoints") ??
        ""

    return {
        id: tokenId,
        owner,
        metadataUri: tokenUri,
        isRevoked: false,
        issuedAt: metadata?.issued_at,
        programName,
        scholarName,
        completionDate,
        artworkUrl,
        issuer,
        reputationPoints,
        txHash: "",
    }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useScholarNft(
    tokenId: string | undefined,
): UseScholarNftResult {
    const { data, isLoading, error } = useQuery({
        queryKey: ["scholar-nft", tokenId],
        queryFn: () => fetchCredentialData(tokenId!),
        enabled: Boolean(tokenId),
        staleTime: 60_000,
        retry: false,
    })

    if (isLoading || (!data && !error)) {
        return { credential: null, status: "loading", error: null }
    }

    if (error) {
        const err = error as Error & { code?: string; reason?: string }
        if (err.code === "REVOKED") {
            return {
                credential: null,
                status: "revoked",
                error: err.reason ?? "This credential has been revoked.",
            }
        }
        const msg = err.message ?? "Failed to load credential"
        const isNotFound =
            msg.includes("TokenNotFound") ||
            msg.includes("not found") ||
            msg.includes("Invalid token")
        return {
            credential: null,
            status: isNotFound ? "not_found" : "error",
            error: msg,
        }
    }

    return { credential: data!, status: "success", error: null }
}
