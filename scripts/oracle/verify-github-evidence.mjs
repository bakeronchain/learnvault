#!/usr/bin/env node

import { createHash } from "node:crypto"

const evidenceUrl = process.argv[2]
const token = process.env.GITHUB_TOKEN

if (!evidenceUrl) {
	console.error("Usage: verify-github-evidence.mjs <github-pr-url>")
	process.exit(2)
}

const match = evidenceUrl.match(
	/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/,
)

if (!match) {
	console.error("Evidence must be a GitHub pull request URL.")
	process.exit(2)
}

const [, owner, repo, pullNumber] = match
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
	console.error(`GitHub API request failed: ${response.status} ${response.statusText}`)
	process.exit(1)
}

const pull = await response.json()
const payload = {
	owner,
	repo,
	pull_number: Number(pullNumber),
	merged: Boolean(pull.merged),
	merge_commit_sha: pull.merge_commit_sha ?? null,
	merged_at: pull.merged_at ?? null,
	html_url: pull.html_url,
}

const evidenceHash = createHash("sha256")
	.update(JSON.stringify(payload))
	.digest("hex")

console.log(
	JSON.stringify(
		{
			verified: payload.merged,
			evidence_hash: evidenceHash,
			payload,
		},
		null,
		2,
	),
)

process.exit(payload.merged ? 0 : 1)
