import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { ProposalCard } from "./ProposalCard"
import type { StoredScholarshipProposal } from "../util/scholarshipApplications"

const mockProposal: StoredScholarshipProposal = {
	id: "1",
	proposalId: "123",
	applicant: "GBRUIOPQRSTUVWXYZ1234567890ABCDEFGHIKLMNOP",
	programName: "Stellar Bootcamp",
	programUrl: "https://example.com",
	programDescription: "Learn Stellar development",
	startDate: "2024-01-01",
	amountUsdc: "1000",
	submittedAt: "2023-12-01T10:00:00Z",
	status: "pending",
	source: "on-chain",
	milestones: [
		{ description: "M1", dueDate: "2024-02-01" },
		{ description: "M2", dueDate: "2024-03-01" },
		{ description: "M3", dueDate: "2024-04-01" },
	],
	daoPath: "/dao#proposal-123",
	walletConfirmed: true
}

describe("ProposalCard", () => {
	it("renders proposal details correctly", () => {
		render(
			<MemoryRouter>
				<ProposalCard proposal={mockProposal} />
			</MemoryRouter>
		)

		expect(screen.getByText("Proposal #123")).toBeDefined()
		expect(screen.getByText("Stellar Bootcamp")).toBeDefined()
		expect(screen.getByText("pending")).toBeDefined()
		expect(screen.getByText("on-chain")).toBeDefined()
		expect(screen.getByText("Learn Stellar development")).toBeDefined()
	})

	it("renders milestones", () => {
		render(
			<MemoryRouter>
				<ProposalCard proposal={mockProposal} />
			</MemoryRouter>
		)

		expect(screen.getByText("Milestone 1")).toBeDefined()
		expect(screen.getByText("M1")).toBeDefined()
		expect(screen.getByText("2024-02-01")).toBeDefined()
	})

	it("applies highlight class when isHighlighted is true", () => {
		const { container } = render(
			<MemoryRouter>
				<ProposalCard proposal={mockProposal} isHighlighted={true} />
			</MemoryRouter>
		)

		const article = container.querySelector("article")
		expect(article?.getAttribute("data-highlighted")).toBe("true")
	})
})
