import { createHash } from "node:crypto"

import { pool } from "../db/index"
import { milestoneStore, type MilestoneReport } from "../db/milestone-store"
import { logger } from "../lib/logger"

const log = logger.child({ module: "github-oracle" })

// Mirrors scripts/oracle/github-evidence-core.mjs — the standalone CLI and this
// service share the same proof-of-work rules. Keep the two in sync.

const PR_URL_RE =
	/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/

export interface ParsedPullRequest {
	owner: string
	repo: string
	pullNumber: number
}

export interface GithubOraclePayload {
	owner: string
	repo: string
	pull_number: number
	merged: boolean
	merge_commit_sha: string | null
	merged_at: string | null
	author_login: string | null
	html_url: string | null
}

export interface GithubOracleChecks {
	merged: boolean
	authorMatches: boolean
	withinWindow: boolean
}

export interface GithubOracleResult {
	verified: boolean
	evidenceHash: string
	payload: GithubOraclePayload
	checks: GithubOracleChecks
	reasons: string[]
}

/** Persisted shape of an oracle verification (stored on milestone_reports). */
export interface OracleResultDetail {
	checks?: GithubOracleChecks
	reasons?: string[]
	payload?: GithubOraclePayload
}

export interface OracleResultInput {
	verified: boolean
	evidence_hash: string
	detail: OracleResultDetail
}

export interface VerifyGithubEvidenceOptions {
	evidenceUrl: string
	/** Linked GitHub login of the claimant; when set, PR author must match. */
	expectedGithubLogin?: string | null
	/** Milestone window opens (inclusive); PR must be merged at/after this. */
	windowStart?: string | Date | null
	/** Milestone window closes (inclusive); PR must be merged at/before this. */
	windowEnd?: string | Date | null
	/** GitHub API token; defaults to process.env.GITHUB_TOKEN. */
	token?: string
	/** Injectable fetch implementation; defaults to global fetch (overridden in tests). */
	fetchImpl?: typeof fetch
}

export type GithubOracleErrorCode = "INVALID_URL" | "API_ERROR"

export class GithubOracleError extends Error {
	constructor(
		message: string,
		public readonly code: GithubOracleErrorCode,
		public readonly status?: number,
	) {
		super(message)
		this.name = "GithubOracleError"
	}
}

/** Parse a GitHub pull request URL into its components, or null if invalid. */
export function parsePullRequestUrl(url: string): ParsedPullRequest | null {
	const match = typeof url === "string" ? url.match(PR_URL_RE) : null
	if (!match) return null
	const [, owner, repo, pullNumber] = match
	return { owner, repo, pullNumber: Number(pullNumber) }
}

function buildEvidencePayload(
	parsed: ParsedPullRequest,
	pull: {
		merged?: boolean
		merge_commit_sha?: string | null
		merged_at?: string | null
		user?: { login?: string | null } | null
		html_url?: string | null
	},
): GithubOraclePayload {
	return {
		owner: parsed.owner,
		repo: parsed.repo,
		pull_number: parsed.pullNumber,
		merged: Boolean(pull.merged),
		merge_commit_sha: pull.merge_commit_sha ?? null,
		merged_at: pull.merged_at ?? null,
		author_login: pull.user?.login ?? null,
		html_url: pull.html_url ?? null,
	}
}

/** Deterministic SHA-256 over the evidence payload, for tamper-evident audit. */
export function hashEvidence(payload: GithubOraclePayload): string {
	return createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}

function toTime(value: string | Date | null | undefined): number | null {
	if (value === null || value === undefined || value === "") return null
	const time =
		value instanceof Date ? value.getTime() : new Date(value).getTime()
	return Number.isNaN(time) ? null : time
}

function normalizeLogin(login: string | null | undefined): string {
	return String(login ?? "")
		.trim()
		.replace(/^@/, "")
		.toLowerCase()
}

function evaluateChecks(
	payload: GithubOraclePayload,
	opts: Pick<
		VerifyGithubEvidenceOptions,
		"expectedGithubLogin" | "windowStart" | "windowEnd"
	>,
): Pick<GithubOracleResult, "verified" | "checks" | "reasons"> {
	const reasons: string[] = []

	const merged = payload.merged === true
	if (!merged) reasons.push("Pull request is not merged.")

	let authorMatches = true
	if (opts.expectedGithubLogin) {
		const expected = normalizeLogin(opts.expectedGithubLogin)
		const actual = normalizeLogin(payload.author_login)
		authorMatches = actual !== "" && actual === expected
		if (!authorMatches) {
			reasons.push(
				`Pull request author "${payload.author_login ?? "unknown"}" does not match linked GitHub account "${opts.expectedGithubLogin}".`,
			)
		}
	}

	let withinWindow = true
	const start = toTime(opts.windowStart)
	const end = toTime(opts.windowEnd)
	if (start !== null || end !== null) {
		const mergedTime = toTime(payload.merged_at)
		if (mergedTime === null) {
			withinWindow = false
			reasons.push(
				"Pull request has no merge timestamp to validate against the milestone window.",
			)
		} else {
			if (start !== null && mergedTime < start) {
				withinWindow = false
				reasons.push(
					"Pull request was merged before the milestone window opened.",
				)
			}
			if (end !== null && mergedTime > end) {
				withinWindow = false
				reasons.push(
					"Pull request was merged after the milestone window closed.",
				)
			}
		}
	}

	return {
		verified: merged && authorMatches && withinWindow,
		checks: { merged, authorMatches, withinWindow },
		reasons,
	}
}

/**
 * Verify a GitHub pull request as milestone proof-of-work.
 *
 * Throws {@link GithubOracleError} for an unparseable URL or a failed GitHub
 * API request; otherwise returns a structured, hashable result describing
 * whether the PR is merged, authored by the claimed account, and merged within
 * the milestone window.
 */
export async function verifyGithubEvidence(
	options: VerifyGithubEvidenceOptions,
): Promise<GithubOracleResult> {
	const fetchImpl = options.fetchImpl ?? globalThis.fetch
	const token = options.token ?? process.env.GITHUB_TOKEN

	const parsed = parsePullRequestUrl(options.evidenceUrl)
	if (!parsed) {
		throw new GithubOracleError(
			"Evidence must be a GitHub pull request URL.",
			"INVALID_URL",
		)
	}

	const response = await fetchImpl(
		`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.pullNumber}`,
		{
			headers: {
				accept: "application/vnd.github+json",
				...(token ? { authorization: `Bearer ${token}` } : {}),
			},
		},
	)

	if (!response.ok) {
		throw new GithubOracleError(
			`GitHub API request failed: ${response.status} ${response.statusText}`,
			"API_ERROR",
			response.status,
		)
	}

	const pull = (await response.json()) as Parameters<
		typeof buildEvidencePayload
	>[1]
	const payload = buildEvidencePayload(parsed, pull)
	const evidenceHash = hashEvidence(payload)
	const { verified, checks, reasons } = evaluateChecks(payload, options)

	return { verified, evidenceHash, payload, checks, reasons }
}

function isRealPool(): boolean {
	return typeof (pool as { totalCount?: number }).totalCount !== "undefined"
}

/** Linked GitHub login for a wallet address, from its profile (best effort). */
async function resolveGithubLogin(
	scholarAddress: string,
): Promise<string | null> {
	if (!isRealPool()) return null
	try {
		const result = await pool.query<{ github: string | null }>(
			`SELECT github FROM user_profiles WHERE address = $1`,
			[scholarAddress],
		)
		return result.rows[0]?.github ?? null
	} catch (err) {
		log.warn({ err }, "resolveGithubLogin failed")
		return null
	}
}

/** Milestone creation time, used as the lower bound of the evidence window. */
async function resolveMilestoneWindowStart(
	courseId: string,
	milestoneId: number,
): Promise<string | null> {
	if (!isRealPool()) return null
	try {
		const result = await pool.query<{ created_at: string }>(
			`SELECT m.created_at
			 FROM milestones m
			 JOIN courses c ON c.id = m.course_id
			 WHERE c.slug = $1 AND m.on_chain_milestone_id = $2
			 LIMIT 1`,
			[courseId, milestoneId],
		)
		return result.rows[0]?.created_at ?? null
	} catch (err) {
		log.warn({ err }, "resolveMilestoneWindowStart failed")
		return null
	}
}

/**
 * Resolve context for a stored milestone report (linked GitHub login + window),
 * run the oracle against its GitHub evidence, and persist the result.
 *
 * Returns null when the report has no GitHub PR evidence to verify. Surfaces the
 * structured result so callers (submission, admin approval) can gate on it.
 */
export async function verifyMilestoneReportEvidence(
	report: MilestoneReport,
	overrides: Partial<VerifyGithubEvidenceOptions> = {},
): Promise<GithubOracleResult | null> {
	if (!report.evidence_github) return null

	const expectedGithubLogin =
		overrides.expectedGithubLogin ??
		(await resolveGithubLogin(report.scholar_address))
	const windowStart =
		overrides.windowStart ??
		(await resolveMilestoneWindowStart(report.course_id, report.milestone_id))
	// The learner cannot submit evidence merged after they reported it.
	const windowEnd = overrides.windowEnd ?? report.submitted_at ?? null

	const result = await verifyGithubEvidence({
		evidenceUrl: report.evidence_github,
		expectedGithubLogin,
		windowStart,
		windowEnd,
		...overrides,
	})

	try {
		await milestoneStore.setOracleResult(report.id, {
			verified: result.verified,
			evidence_hash: result.evidenceHash,
			detail: {
				checks: result.checks,
				reasons: result.reasons,
				payload: result.payload,
			},
		})
	} catch (err) {
		log.error({ err, reportId: report.id }, "persisting oracle result failed")
	}

	return result
}
