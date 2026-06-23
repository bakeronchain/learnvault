// Pure, dependency-free core for GitHub PR proof-of-work verification.
//
// This is the single source of truth for the verification *rules* used by the
// standalone CLI (verify-github-evidence.mjs). The server mirrors the same
// rules in TypeScript at server/src/services/github-oracle.service.ts so the
// milestone pipeline and the CLI stay consistent — keep the two in sync.

import { createHash } from "node:crypto"

const PR_URL_RE =
	/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/

/**
 * Parse a GitHub pull request URL into its components.
 * @returns {{ owner: string, repo: string, pullNumber: number } | null}
 */
export function parsePullRequestUrl(url) {
	const match = typeof url === "string" ? url.match(PR_URL_RE) : null
	if (!match) return null
	const [, owner, repo, pullNumber] = match
	return { owner, repo, pullNumber: Number(pullNumber) }
}

/**
 * Build the canonical evidence payload from a parsed URL and the GitHub PR API
 * response. The payload is what gets hashed, so its shape must stay stable.
 */
export function buildEvidencePayload({ owner, repo, pullNumber }, pull) {
	return {
		owner,
		repo,
		pull_number: Number(pullNumber),
		merged: Boolean(pull.merged),
		merge_commit_sha: pull.merge_commit_sha ?? null,
		merged_at: pull.merged_at ?? null,
		author_login: pull.user?.login ?? null,
		html_url: pull.html_url ?? null,
	}
}

/** Deterministic SHA-256 over the evidence payload, for tamper-evident audit. */
export function hashEvidence(payload) {
	return createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}

function toTime(value) {
	if (value === null || value === undefined || value === "") return null
	const time =
		value instanceof Date ? value.getTime() : new Date(value).getTime()
	return Number.isNaN(time) ? null : time
}

function normalizeLogin(login) {
	return String(login ?? "")
		.trim()
		.replace(/^@/, "")
		.toLowerCase()
}

/**
 * Evaluate the proof-of-work checks against the evidence payload.
 *
 * @param {object} payload                  output of buildEvidencePayload
 * @param {object} [opts]
 * @param {string|null} [opts.expectedGithubLogin] linked GitHub account of the claimant
 * @param {string|Date|null} [opts.windowStart]    milestone window opens (inclusive)
 * @param {string|Date|null} [opts.windowEnd]      milestone window closes (inclusive)
 * @returns {{ verified: boolean, checks: { merged: boolean, authorMatches: boolean, withinWindow: boolean }, reasons: string[] }}
 */
export function evaluateChecks(payload, opts = {}) {
	const { expectedGithubLogin, windowStart, windowEnd } = opts
	const reasons = []

	const merged = payload.merged === true
	if (!merged) reasons.push("Pull request is not merged.")

	let authorMatches = true
	if (expectedGithubLogin) {
		const expected = normalizeLogin(expectedGithubLogin)
		const actual = normalizeLogin(payload.author_login)
		authorMatches = actual !== "" && actual === expected
		if (!authorMatches) {
			reasons.push(
				`Pull request author "${payload.author_login ?? "unknown"}" does not match linked GitHub account "${expectedGithubLogin}".`,
			)
		}
	}

	let withinWindow = true
	const start = toTime(windowStart)
	const end = toTime(windowEnd)
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
