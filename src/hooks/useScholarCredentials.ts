import { useQuery } from "@tanstack/react-query"

export interface ScholarCredential {
	token_id: number
	course_id: string
	metadata_uri: string | null
	minted_at: string
	revoked: boolean
	programName: string
	artworkUrl: string
}

interface ApiResponse {
	data?: Array<{
		token_id: number
		course_id: string
		metadata_uri: string | null
		minted_at: string
		revoked: boolean
	}>
}

async function fetchCredentials(address: string): Promise<ScholarCredential[]> {
	const response = await fetch(`/api/credentials/${address}`)

	if (!response.ok) {
		throw new Error("Failed to fetch credentials")
	}

	const json = (await response.json()) as ApiResponse
	const credentials = json.data ?? []

	return credentials.map((cred) => ({
		token_id: cred.token_id,
		course_id: cred.course_id,
		metadata_uri: cred.metadata_uri,
		minted_at: cred.minted_at,
		revoked: cred.revoked,
		programName: cred.course_id,
		artworkUrl: cred.metadata_uri
			? `https://ipfs.io/ipfs/${cred.metadata_uri.replace("ipfs://", "")}`
			: "",
	}))
}

export function useScholarCredentials(address: string | undefined) {
	const query = useQuery({
		queryKey: ["scholar-credentials", address],
		queryFn: () => fetchCredentials(address!),
		enabled: Boolean(address),
		staleTime: 60_000,
		retry: false,
	})

	return {
		credentials: query.data ?? [],
		isLoading: query.isLoading,
		error: query.error ? "Failed to load credentials" : null,
	}
}
