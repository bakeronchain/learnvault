import {
	GithubOracleError,
	parsePullRequestUrl,
	verifyGithubEvidence,
} from "../services/github-oracle.service"

type PullResponse = {
	merged?: boolean
	merge_commit_sha?: string | null
	merged_at?: string | null
	user?: { login?: string | null } | null
	html_url?: string | null
}

function mockFetch(
	pull: PullResponse,
	init: { ok?: boolean; status?: number; statusText?: string } = {},
): { fetchImpl: typeof fetch; calls: string[] } {
	const calls: string[] = []
	const fetchImpl = (async (url: string) => {
		calls.push(String(url))
		return {
			ok: init.ok ?? true,
			status: init.status ?? 200,
			statusText: init.statusText ?? "OK",
			json: async () => pull,
		}
	}) as unknown as typeof fetch
	return { fetchImpl, calls }
}

const PR_URL = "https://github.com/acme/widgets/pull/42"

const mergedPull: PullResponse = {
	merged: true,
	merge_commit_sha: "abc123",
	merged_at: "2026-03-01T00:00:00Z",
	user: { login: "octocat" },
	html_url: PR_URL,
}

describe("parsePullRequestUrl", () => {
	it("parses a valid PR url", () => {
		expect(parsePullRequestUrl(PR_URL)).toEqual({
			owner: "acme",
			repo: "widgets",
			pullNumber: 42,
		})
	})

	it("tolerates trailing path/query/fragment", () => {
		expect(parsePullRequestUrl(`${PR_URL}/files?w=1#diff`)).toEqual({
			owner: "acme",
			repo: "widgets",
			pullNumber: 42,
		})
	})

	it("rejects non-PR urls", () => {
		expect(parsePullRequestUrl("https://github.com/acme/widgets")).toBeNull()
		expect(
			parsePullRequestUrl("https://example.com/acme/widgets/pull/1"),
		).toBeNull()
		expect(parsePullRequestUrl("not a url")).toBeNull()
	})
})

describe("verifyGithubEvidence", () => {
	it("hits the GitHub pulls API for the parsed PR", async () => {
		const { fetchImpl, calls } = mockFetch(mergedPull)
		await verifyGithubEvidence({ evidenceUrl: PR_URL, fetchImpl })
		expect(calls).toEqual([
			"https://api.github.com/repos/acme/widgets/pulls/42",
		])
	})

	it("verifies a merged PR with matching author inside the window", async () => {
		const { fetchImpl } = mockFetch(mergedPull)
		const result = await verifyGithubEvidence({
			evidenceUrl: PR_URL,
			expectedGithubLogin: "OctoCat",
			windowStart: "2026-01-01T00:00:00Z",
			windowEnd: "2026-06-01T00:00:00Z",
			fetchImpl,
		})
		expect(result.verified).toBe(true)
		expect(result.checks).toEqual({
			merged: true,
			authorMatches: true,
			withinWindow: true,
		})
		expect(result.reasons).toEqual([])
		expect(result.evidenceHash).toMatch(/^[0-9a-f]{64}$/)
	})

	it("produces a deterministic evidence hash", async () => {
		const a = await verifyGithubEvidence({
			evidenceUrl: PR_URL,
			fetchImpl: mockFetch(mergedPull).fetchImpl,
		})
		const b = await verifyGithubEvidence({
			evidenceUrl: PR_URL,
			fetchImpl: mockFetch(mergedPull).fetchImpl,
		})
		expect(a.evidenceHash).toBe(b.evidenceHash)
	})

	it("fails when the PR is not merged", async () => {
		const { fetchImpl } = mockFetch({ ...mergedPull, merged: false })
		const result = await verifyGithubEvidence({
			evidenceUrl: PR_URL,
			fetchImpl,
		})
		expect(result.verified).toBe(false)
		expect(result.checks.merged).toBe(false)
		expect(result.reasons).toContain("Pull request is not merged.")
	})

	it("fails when the author does not match the linked account", async () => {
		const { fetchImpl } = mockFetch(mergedPull)
		const result = await verifyGithubEvidence({
			evidenceUrl: PR_URL,
			expectedGithubLogin: "someone-else",
			fetchImpl,
		})
		expect(result.verified).toBe(false)
		expect(result.checks.authorMatches).toBe(false)
		expect(result.reasons.join(" ")).toContain(
			"does not match linked GitHub account",
		)
	})

	it("fails when merged outside the milestone window", async () => {
		const { fetchImpl } = mockFetch(mergedPull)
		const result = await verifyGithubEvidence({
			evidenceUrl: PR_URL,
			windowStart: "2026-04-01T00:00:00Z",
			windowEnd: "2026-06-01T00:00:00Z",
			fetchImpl,
		})
		expect(result.verified).toBe(false)
		expect(result.checks.withinWindow).toBe(false)
		expect(result.reasons).toContain(
			"Pull request was merged before the milestone window opened.",
		)
	})

	it("fails the window check when a merge timestamp is missing", async () => {
		const { fetchImpl } = mockFetch({ ...mergedPull, merged_at: null })
		const result = await verifyGithubEvidence({
			evidenceUrl: PR_URL,
			windowEnd: "2026-06-01T00:00:00Z",
			fetchImpl,
		})
		expect(result.checks.withinWindow).toBe(false)
	})

	it("throws INVALID_URL for a non-PR url", async () => {
		const { fetchImpl } = mockFetch(mergedPull)
		await expect(
			verifyGithubEvidence({
				evidenceUrl: "https://github.com/acme",
				fetchImpl,
			}),
		).rejects.toMatchObject({ code: "INVALID_URL" })
	})

	it("throws API_ERROR when GitHub responds non-ok", async () => {
		const { fetchImpl } = mockFetch(mergedPull, {
			ok: false,
			status: 404,
			statusText: "Not Found",
		})
		await expect(
			verifyGithubEvidence({ evidenceUrl: PR_URL, fetchImpl }),
		).rejects.toBeInstanceOf(GithubOracleError)
	})

	it("forwards the token as a bearer authorization header", async () => {
		const headerBag: Array<Record<string, string>> = []
		const fetchImpl = (async (_url: string, opts: RequestInit) => {
			headerBag.push(opts.headers as Record<string, string>)
			return {
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => mergedPull,
			}
		}) as unknown as typeof fetch
		await verifyGithubEvidence({
			evidenceUrl: PR_URL,
			token: "secret",
			fetchImpl,
		})
		expect(headerBag[0].authorization).toBe("Bearer secret")
	})
})
