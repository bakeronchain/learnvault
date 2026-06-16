import { useMemo, useState } from "react"

export type ChartInterval = "7d" | "30d" | "ytd"

export interface AnalyticsDataPoint {
	date: string
	volume: number       // total USDC contributed
	gasCosts: number     // USD equivalent of Soroban XLM fees
	netRoyalties: number  // volume - gasCosts
	transactions: number  // number of events
}

export interface AnalyticsSummary {
	totalVolume: number
	totalGasCosts: number
	totalNetRoyalties: number
	avgTransactionValue: number
	transactionCount: number
}

export function useEarningsAnalytics() {
	const [interval, setInterval] = useState<ChartInterval>("30d")
	const [isLoading, setIsLoading] = useState(false)

	const data = useMemo<AnalyticsDataPoint[]>(() => {
		const today = new Date()
		const result: AnalyticsDataPoint[] = []

		if (interval === "7d") {
			// Generate 7 days of daily data
			const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
			for (let i = 6; i >= 0; i--) {
				const d = new Date()
				d.setDate(today.getDate() - i)
				const dayName = weekdays[d.getDay()]
				const dateString = `${dayName} ${d.getDate()}`

				// Seed-based random values to keep them consistent
				const seed = d.getDate()
				const volume = Math.floor(1000 + (seed * 117) % 3500)
				const gasCosts = parseFloat((0.15 + (seed * 13) % 0.85).toFixed(2))
				const netRoyalties = parseFloat((volume - gasCosts).toFixed(2))
				const transactions = Math.floor(5 + (seed * 3) % 15)

				result.push({
					date: dateString,
					volume,
					gasCosts,
					netRoyalties,
					transactions,
				})
			}
		} else if (interval === "30d") {
			// Generate 30 days of daily data
			const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
			for (let i = 29; i >= 0; i--) {
				const d = new Date()
				d.setDate(today.getDate() - i)
				const dateString = `${months[d.getMonth()]} ${d.getDate()}`

				const seed = d.getDate() + d.getMonth() * 30
				const volume = Math.floor(1500 + (seed * 163) % 4500)
				const gasCosts = parseFloat((0.2 + (seed * 27) % 1.1).toFixed(2))
				const netRoyalties = parseFloat((volume - gasCosts).toFixed(2))
				const transactions = Math.floor(8 + (seed * 7) % 20)

				result.push({
					date: dateString,
					volume,
					gasCosts,
					netRoyalties,
					transactions,
				})
			}
		} else {
			// Year-to-Date (YTD) - Monthly data
			const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
			const currentMonth = today.getMonth()

			for (let i = 0; i <= currentMonth; i++) {
				const dateString = months[i]
				const seed = i + 1
				const volume = Math.floor(35000 + (seed * 13451) % 65000)
				const gasCosts = parseFloat((12.5 + (seed * 153) % 48.5).toFixed(2))
				const netRoyalties = parseFloat((volume - gasCosts).toFixed(2))
				const transactions = Math.floor(120 + (seed * 43) % 250)

				result.push({
					date: dateString,
					volume,
					gasCosts,
					netRoyalties,
					transactions,
				})
			}
		}

		return result
	}, [interval])

	const summary = useMemo<AnalyticsSummary>(() => {
		const totalVolume = data.reduce((acc, curr) => acc + curr.volume, 0)
		const totalGasCosts = data.reduce((acc, curr) => acc + curr.gasCosts, 0)
		const totalNetRoyalties = data.reduce((acc, curr) => acc + curr.netRoyalties, 0)
		const transactionCount = data.reduce((acc, curr) => acc + curr.transactions, 0)
		const avgTransactionValue = transactionCount > 0 
			? parseFloat((totalVolume / transactionCount).toFixed(2)) 
			: 0

		return {
			totalVolume,
			totalGasCosts,
			totalNetRoyalties,
			avgTransactionValue,
			transactionCount,
		}
	}, [data])

	const changeInterval = (newInterval: ChartInterval) => {
		setIsLoading(true)
		setInterval(newInterval)
		// Simulate small network delay for realistic responsiveness
		setTimeout(() => {
			setIsLoading(false)
		}, 300)
	}

	return {
		data,
		summary,
		interval,
		setInterval: changeInterval,
		isLoading,
	}
}
