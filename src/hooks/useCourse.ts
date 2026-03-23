import { useState, useCallback, useEffect } from "react"

export type MilestoneStatusState = "locked" | "in_progress" | "completed"

export interface MilestoneState {
	status: MilestoneStatusState
	txHash?: string
}

// In-memory mock store so state persists across hook calls if needed
const mockStore: Record<string, MilestoneState> = {
	"stellar-basics-1": { status: "completed", txHash: "0x123abc456def789" },
	"stellar-basics-2": { status: "in_progress" },
	"stellar-basics-3": { status: "locked" },
}

export function useCourse(courseId: string, milestoneId: number) {
	const storeKey = `${courseId}-${milestoneId}`

	const [state, setState] = useState<MilestoneState>(() => {
		return mockStore[storeKey] || { status: "locked" }
	})

	const [isSimulating, setIsSimulating] = useState(false)

	const completeMilestone = useCallback(async () => {
		// Optimistic update
		setState((prev) => ({ ...prev, status: "completed" }))
		setIsSimulating(true)

		try {
			// Simulate network delay
			await new Promise((resolve) => setTimeout(resolve, 2000))

			const mockTxHash = `0x${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`

			// Complete transaction
			setState({ status: "completed", txHash: mockTxHash })
			mockStore[storeKey] = { status: "completed", txHash: mockTxHash }

			// Automatically unlock the next milestone if applicable
			const nextKey = `${courseId}-${milestoneId + 1}`
			if (mockStore[nextKey] && mockStore[nextKey].status === "locked") {
				mockStore[nextKey] = { status: "in_progress" }
			}

			return mockTxHash
		} catch (error) {
			// Revert optimistic update
			setState({ status: "in_progress" })
			mockStore[storeKey] = { status: "in_progress" }
			throw error
		} finally {
			setIsSimulating(false)
		}
	}, [courseId, milestoneId, storeKey])

	// Handle updates if global store changes (for the unlock next logic)
	useEffect(() => {
		const interval = setInterval(() => {
			if (mockStore[storeKey] && mockStore[storeKey].status !== state.status) {
				setState(mockStore[storeKey])
			}
		}, 1000)
		return () => clearInterval(interval)
	}, [storeKey, state.status])

	return {
		...state,
		isSimulating,
		completeMilestone,
	}
}
