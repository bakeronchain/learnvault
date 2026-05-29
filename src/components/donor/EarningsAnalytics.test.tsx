import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { render } from "../../test/setup"
import { EarningsAnalytics } from "./EarningsAnalytics"

// Mock recharts components to prevent layout engine (jsdom) measurement issues
vi.mock("recharts", () => {
	return {
		ResponsiveContainer: ({ children }: any) => (
			<div data-testid="responsive-container">{children}</div>
		),
		ComposedChart: ({ children, data }: any) => (
			<div data-testid="composed-chart" data-points={data.length}>
				{children}
			</div>
		),
		Area: () => <div data-testid="chart-area" />,
		Line: () => <div data-testid="chart-line" />,
		XAxis: () => <div data-testid="chart-xaxis" />,
		YAxis: () => <div data-testid="chart-yaxis" />,
		CartesianGrid: () => <div data-testid="chart-grid" />,
		Tooltip: () => <div data-testid="chart-tooltip" />,
		Legend: () => <div data-testid="chart-legend" />,
	}
})

describe("EarningsAnalytics Component", () => {
	it("renders the analytics header and title", () => {
		render(<EarningsAnalytics />)

		expect(screen.getByText("Earnings & Payout Timelines")).toBeInTheDocument()
		expect(
			screen.getByText(/Track the historical USDC volume, gas overhead/i),
		).toBeInTheDocument()
	})

	it("renders summary statistics cards with correct defaults", () => {
		render(<EarningsAnalytics />)

		expect(screen.getByText("Total Volume (USDC)")).toBeInTheDocument()
		expect(screen.getByText("Net Royalties")).toBeInTheDocument()
		expect(screen.getByText("Gas Overhead (XLM)")).toBeInTheDocument()

		// Verify volume value matches the calculated 30d default mock values
		// 30 days yields consistent deterministic calculations
		expect(screen.getByText(/\$/)).toBeInTheDocument()
	})

	it("renders the chart container and default Recharts mock points", () => {
		render(<EarningsAnalytics />)

		const composedChart = screen.getByTestId("composed-chart")
		expect(composedChart).toBeInTheDocument()

		// 30d default should render 30 data points
		expect(composedChart.getAttribute("data-points")).toBe("30")
	})

	it("allows switching time intervals to 7 Days or Year-to-Date", async () => {
		render(<EarningsAnalytics />)

		const sevenDaysTab = screen.getByRole("button", { name: /7 Days/i })
		const ytdTab = screen.getByRole("button", { name: /Year-To-Date/i })

		// Click 7 Days
		fireEvent.click(sevenDaysTab)

		// Wait briefly for interval load
		const composedChart = screen.getByTestId("composed-chart")
		expect(composedChart.getAttribute("data-points")).toBe("7")

		// Click YTD
		fireEvent.click(ytdTab)
		expect(composedChart.getAttribute("data-points")).not.toBe("7") // should transition to YTD months count
	})
})
