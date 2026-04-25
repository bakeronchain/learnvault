import { type Page, type Route } from "@playwright/test"

import { E2E_WALLET_ADDRESS } from "./mock-wallet"

/** Distinct author so the viewer can upvote “someone else’s” comment. */
export const E2E_PEER_ADDRESS = `G${"B".repeat(52)}XXX`

type MockProposal = {
	id: number
	author_address: string
	title: string
	description: string
	amount: string
	votes_for: string
	votes_against: string
	status: "pending" | "approved" | "rejected"
	deadline: string | null
	created_at: string
	user_vote_support: boolean | null
}

export type MockComment = {
	id: number
	proposal_id: string
	author_address: string
	parent_id: number | null
	content: string
	upvotes: number
	downvotes: number
	is_pinned: boolean
	created_at: string
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
	await route.fulfill({
		status,
		contentType: "application/json",
		body: JSON.stringify(body),
	})
}

/**
 * In-memory DAO + comments API so Playwright runs without a backend.
 * Handles proposal listing, voting, and full comment CRUD used by governance E2E.
 */
export async function installDaoApiMocks(page: Page) {
	let nextProposalId = 2
	let nextCommentId = 1000
	const proposals: MockProposal[] = [
		{
			id: 1,
			author_address: E2E_WALLET_ADDRESS,
			title: "Seed proposal",
			description: "Initial backend-backed proposal",
			amount: "100",
			votes_for: "0",
			votes_against: "0",
			status: "pending",
			deadline: "2099-01-01T00:00:00.000Z",
			created_at: "2026-03-28T10:00:00.000Z",
			user_vote_support: null,
		},
	]

	const commentsByProposal = new Map<number, MockComment[]>([
		[
			1,
			[
				{
					id: 101,
					proposal_id: "1",
					author_address: E2E_PEER_ADDRESS,
					parent_id: null,
					content: "Peer discussion point",
					upvotes: 2,
					downvotes: 0,
					is_pinned: false,
					created_at: "2026-03-28T10:05:00.000Z",
				},
			],
		],
	])

	await page.route("**/api/**", async (route) => {
		const request = route.request()
		const url = new URL(request.url())
		const { pathname, searchParams } = url
		const method = request.method()

		if (pathname === "/api/proposals" && method === "GET") {
			const viewer = searchParams.get("viewer_address")
			const response = proposals.map((proposal) => ({
				...proposal,
				user_vote_support:
					viewer?.toLowerCase() === E2E_WALLET_ADDRESS.toLowerCase()
						? proposal.user_vote_support
						: null,
			}))

			return fulfillJson(route, {
				proposals: response,
				total: response.length,
				page: 1,
			})
		}

		if (pathname === "/api/proposals" && method === "POST") {
			const body = request.postDataJSON() as {
				author_address: string
				title: string
				description: string
				requested_amount: string
			}

			const created: MockProposal = {
				id: nextProposalId++,
				author_address: body.author_address,
				title: body.title,
				description: body.description,
				amount: body.requested_amount,
				votes_for: "0",
				votes_against: "0",
				status: "pending",
				deadline: "2099-01-01T00:00:00.000Z",
				created_at: new Date().toISOString(),
				user_vote_support: null,
			}

			proposals.unshift(created)
			commentsByProposal.set(created.id, [
				{
					id: nextCommentId++,
					proposal_id: String(created.id),
					author_address: created.author_address,
					parent_id: null,
					content: "Fresh discussion thread",
					upvotes: 0,
					downvotes: 0,
					is_pinned: false,
					created_at: created.created_at,
				},
			])

			return fulfillJson(route, {
				proposal_id: created.id,
				tx_hash: `tx-${created.id}`,
			})
		}

		if (
			pathname.startsWith("/api/proposals/") &&
			pathname.endsWith("/comments") &&
			method === "GET"
		) {
			const proposalId = Number.parseInt(pathname.split("/")[3] ?? "", 10)
			return fulfillJson(route, commentsByProposal.get(proposalId) ?? [])
		}

		if (pathname === "/api/comments" && method === "POST") {
			const body = request.postDataJSON() as {
				proposalId: string
				content: string
				parentId?: number | null
			}
			const proposalId = Number.parseInt(String(body.proposalId), 10)
			const list = commentsByProposal.get(proposalId) ?? []
			const created: MockComment = {
				id: nextCommentId++,
				proposal_id: String(proposalId),
				author_address: E2E_WALLET_ADDRESS,
				parent_id: body.parentId ?? null,
				content: body.content,
				upvotes: 0,
				downvotes: 0,
				is_pinned: false,
				created_at: new Date().toISOString(),
			}
			list.push(created)
			commentsByProposal.set(proposalId, list)
			return fulfillJson(route, created, 201)
		}

		const commentIdMatch = pathname.match(/^\/api\/comments\/(\d+)\/?$/)
		if (commentIdMatch && method === "PATCH") {
			const commentId = Number.parseInt(commentIdMatch[1] ?? "", 10)
			const body = request.postDataJSON() as { content: string }
			for (const list of commentsByProposal.values()) {
				const found = list.find((c) => c.id === commentId)
				if (found) {
					found.content = body.content
					return fulfillJson(route, found)
				}
			}
			return fulfillJson(route, { error: "Not found" }, 404)
		}

		if (commentIdMatch && method === "DELETE") {
			const commentId = Number.parseInt(commentIdMatch[1] ?? "", 10)
			for (const list of commentsByProposal.values()) {
				const idx = list.findIndex((c) => c.id === commentId)
				if (idx >= 0) {
					list.splice(idx, 1)
					return fulfillJson(route, { success: true })
				}
			}
			return fulfillJson(route, { error: "Not found" }, 404)
		}

		const voteMatch = pathname.match(/^\/api\/comments\/(\d+)\/vote\/?$/)
		if (voteMatch && method === "PUT") {
			const commentId = Number.parseInt(voteMatch[1] ?? "", 10)
			const body = request.postDataJSON() as { type: "upvote" | "downvote" }
			for (const list of commentsByProposal.values()) {
				const found = list.find((c) => c.id === commentId)
				if (found) {
					if (body.type === "upvote") found.upvotes += 1
					else if (body.type === "downvote") found.downvotes += 1
					return fulfillJson(route, found)
				}
			}
			return fulfillJson(route, { error: "Not found" }, 404)
		}

		if (pathname.startsWith("/api/proposals/") && method === "GET") {
			const proposalId = Number.parseInt(pathname.split("/")[3] ?? "", 10)
			const proposal = proposals.find((item) => item.id === proposalId)

			if (!proposal) {
				return fulfillJson(route, { error: "Not found" }, 404)
			}

			return fulfillJson(route, proposal)
		}

		if (pathname.startsWith("/api/governance/voting-power/")) {
			return fulfillJson(route, { gov_balance: "10" })
		}

		if (pathname === "/api/governance/vote" && method === "POST") {
			const body = request.postDataJSON() as {
				proposal_id: number
				support: boolean
			}
			const proposal = proposals.find((item) => item.id === body.proposal_id)

			if (!proposal) {
				return fulfillJson(route, { error: "Not found" }, 404)
			}

			if (body.support) {
				proposal.votes_for = String(Number(proposal.votes_for) + 10)
			} else {
				proposal.votes_against = String(Number(proposal.votes_against) + 10)
			}
			proposal.user_vote_support = body.support

			return fulfillJson(route, {
				tx_hash: `vote-${proposal.id}`,
				votes_for: proposal.votes_for,
				votes_against: proposal.votes_against,
			})
		}

		return route.continue()
	})
}
