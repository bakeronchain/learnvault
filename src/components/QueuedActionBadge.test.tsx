import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { QueuedActionBadge } from "./QueuedActionBadge"

describe("QueuedActionBadge", () => {
	it("shows 'Queued' for pending status", () => {
		render(<QueuedActionBadge status="queued" />)
		expect(screen.getByText("Queued")).toBeDefined()
	})

	it("shows 'Synced' for synced status", () => {
		render(<QueuedActionBadge status="synced" />)
		expect(screen.getByText("Synced")).toBeDefined()
	})

	it("shows 'Failed' for failed status", () => {
		render(<QueuedActionBadge status="failed" errorMessage="HTTP 500" />)
		expect(screen.getByText("Failed")).toBeDefined()
	})
})
