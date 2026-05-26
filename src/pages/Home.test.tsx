import { describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import Home from "./Home"
import { render, screen } from "../test/setup"

vi.mock("@stellar/design-system", () => ({
	Icon: {
		Lightbulb01: () => null,
		Trophy01: () => null,
		Star01: () => null,
		Users01: () => null,
	},
}))

vi.mock("../hooks/useCourses", () => ({
	useEnrolledCourses: () => ({
		enrolledCourses: [],
		isLoading: false,
	}),
}))

describe("Home", () => {
	it("renders scholarship alumni spotlight content", () => {
		render(
			<MemoryRouter>
				<Home />
			</MemoryRouter>,
		)

		expect(
			screen.getByRole("heading", { name: "Scholarship Alumni Spotlight" }),
		).toBeInTheDocument()
		expect(screen.getByText("Amina Diallo")).toBeInTheDocument()
		expect(screen.getByText("Diego Alvarez")).toBeInTheDocument()
		expect(screen.getByText("Grace Mwangi")).toBeInTheDocument()
		expect(screen.getAllByText(/Class of 2025/i)).toHaveLength(2)
	})
})
