import { useState, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

interface BadgeAward {
	badgeName: string
	badgeType: string
}

export function useBadgeAwards() {
	const [awards, setAwards] = useState<BadgeAward[]>([])
	const queryClient = useQueryClient()

	const addAward = useCallback((badgeName: string, badgeType: string) => {
		setAwards((prev) => [...prev, { badgeName, badgeType }])
	}, [])

	const dismissAward = useCallback((index: number) => {
		setAwards((prev) => prev.filter((_, i) => i !== index))
	}, [])

	const dismissAll = useCallback(() => {
		setAwards([])
	}, [])

	// Refresh badge data when an award is added
	const refreshBadges = useCallback((address: string) => {
		queryClient.invalidateQueries({ queryKey: ["badges", address] })
	}, [queryClient])

	return {
		awards,
		addAward,
		dismissAward,
		dismissAll,
		refreshBadges,
	}
}
