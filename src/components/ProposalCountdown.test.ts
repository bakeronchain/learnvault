import { describe, expect, it } from "vitest"
import { getProposalCountdownState } from "./ProposalCountdown"

describe("getProposalCountdownState", () => {
	it("returns Voting closed in red when deadline is now", () => {
		expect(getProposalCountdownState(100, 100)).toEqual({
			label: "Voting closed",
			tone: "red",
		})
	})

	it("returns Voting closed in red when deadline is past", () => {
		expect(getProposalCountdownState(100, 101)).toEqual({
			label: "Voting closed",
			tone: "red",
		})
	})

	it("shows green with days and hours when at least 24 hours remain", () => {
		const twoDaysThreeHoursInLedgers = ((2 * 24 + 3) * 60 * 60) / 6
		expect(getProposalCountdownState(twoDaysThreeHoursInLedgers, 0)).toEqual({
			label: "2 days 3 hours remaining",
			tone: "green",
		})
	})

	it("shows orange with hours and minutes when under 24 hours remain", () => {
		const threeHoursThirtyMinutesInLedgers = ((3 * 60 + 30) * 60) / 6
		expect(
			getProposalCountdownState(threeHoursThirtyMinutesInLedgers, 0),
		).toEqual({
			label: "3 hours 30 min remaining",
			tone: "orange",
		})
	})
})
