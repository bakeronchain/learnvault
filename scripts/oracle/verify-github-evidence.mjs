#!/usr/bin/env node

// CLI wrapper around the shared GitHub proof-of-work core. The same rules run
// inside the milestone verification pipeline via
// server/src/services/github-oracle.service.ts — this script lets operators
// verify a single PR by hand.
//
// Usage:
//   verify-github-evidence.mjs <github-pr-url> [--login <github-login>] \
//     [--window-start <iso>] [--window-end <iso>]
//
// Exit codes: 0 = verified, 1 = not verified / API error, 2 = bad usage.

import {
	buildEvidencePayload,
	evaluateChecks,
	hashEvidence,
	parsePullRequestUrl,
} from "./github-evidence-core.mjs"

function parseArgs(argv) {
	const positional = []
	const flags = {}
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg.startsWith("--")) {
			flags[arg.slice(2)] = argv[++i]
		} else {
			positional.push(arg)
		}
	}
	return { positional, flags }
}

const { positional, flags } = parseArgs(process.argv.slice(2))
const evidenceUrl = positional[0]
const token = process.env.GITHUB_TOKEN

if (!evidenceUrl) {
	console.error(
		"Usage: verify-github-evidence.mjs <github-pr-url> [--login <github-login>] [--window-start <iso>] [--window-end <iso>]",
	)
	process.exit(2)
}

const parsed = parsePullRequestUrl(evidenceUrl)
if (!parsed) {
	console.error("Evidence must be a GitHub pull request URL.")
	process.exit(2)
}

const { owner, repo, pullNumber } = parsed
const response = await fetch(
	`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`,
	{
		headers: {
			accept: "application/vnd.github+json",
			...(token ? { authorization: `Bearer ${token}` } : {}),
		},
	},
)

if (!response.ok) {
	console.error(
		`GitHub API request failed: ${response.status} ${response.statusText}`,
	)
	process.exit(1)
}

const pull = await response.json()
const payload = buildEvidencePayload(parsed, pull)
const evidenceHash = hashEvidence(payload)
const { verified, checks, reasons } = evaluateChecks(payload, {
	expectedGithubLogin: flags.login,
	windowStart: flags["window-start"],
	windowEnd: flags["window-end"],
})

console.log(
	JSON.stringify(
		{ verified, evidence_hash: evidenceHash, checks, reasons, payload },
		null,
		2,
	),
)

process.exit(verified ? 0 : 1)
