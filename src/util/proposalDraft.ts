import type { ProposalType } from "../pages/DaoPropose"

export interface ProposalDraft {
	title: string
	description: string
	type: ProposalType
	applicationUrl: string
	fundingAmount: string
	parameterName: string
	parameterValue: string
	parameterReason: string
	courseTitle: string
	courseDescription: string
	courseDuration: string
	courseDifficulty: string
	savedAt: number
}

const DRAFT_STORAGE_KEY = "learnvault:proposal-draft"

const isBrowser = typeof window !== "undefined" && typeof localStorage !== "undefined"

export function saveProposalDraft(data: Omit<ProposalDraft, "savedAt">): void {
	if (!isBrowser) return

	try {
		const draft: ProposalDraft = {
			...data,
			savedAt: Date.now(),
		}
		localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
	} catch (error) {
		console.error("Failed to save proposal draft:", error)
	}
}

export function loadProposalDraft(): ProposalDraft | null {
	if (!isBrowser) return null

	try {
		const stored = localStorage.getItem(DRAFT_STORAGE_KEY)
		if (!stored) return null

		const draft = JSON.parse(stored) as ProposalDraft

		// Validate that the draft has required fields
		if (
			typeof draft.title !== "string" &&
			typeof draft.description !== "string" &&
			typeof draft.type !== "string"
		) {
			clearProposalDraft()
			return null
		}

		return draft
	} catch (error) {
		console.error("Failed to load proposal draft:", error)
		clearProposalDraft()
		return null
	}
}

export function clearProposalDraft(): void {
	if (!isBrowser) return

	try {
		localStorage.removeItem(DRAFT_STORAGE_KEY)
	} catch (error) {
		console.error("Failed to clear proposal draft:", error)
	}
}

export function hasProposalDraft(): boolean {
	if (!isBrowser) return false

	try {
		return localStorage.getItem(DRAFT_STORAGE_KEY) !== null
	} catch {
		return false
	}
}

export function getDraftTimestamp(): number | null {
	if (!isBrowser) return null

	try {
		const stored = localStorage.getItem(DRAFT_STORAGE_KEY)
		if (!stored) return null

		const draft = JSON.parse(stored) as ProposalDraft
		return draft.savedAt ?? null
	} catch {
		return null
	}
}