import { type ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import App from "./App"
import appSource from "./App.tsx?raw"
import { render, screen } from "./test/setup"

vi.mock("./components/ErrorBoundary", () => ({
	default: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("./components/Footer", () => ({
	default: () => <div data-testid="footer" />,
}))

vi.mock("./components/NavBar", () => ({
	default: () => <div data-testid="navbar" />,
}))

vi.mock("./components/NetworkPreconnect", () => ({
	default: () => null,
}))

vi.mock("./components/Toast/ToastProvider", () => ({
	ToastProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("./components/WalletToastWatcher", () => ({
	WalletToastWatcher: () => null,
}))

vi.mock("./pages/Admin", () => ({ default: () => <div>Admin</div> }))
vi.mock("./pages/Courses", () => ({
	default: () => <div>Courses Page</div>,
}))
vi.mock("./pages/Credential", () => ({
	default: () => <div>Credential</div>,
}))
vi.mock("./pages/Dao", () => ({ default: () => <div>Dao</div> }))
vi.mock("./pages/DaoProposals", () => ({
	default: () => <div>Dao Proposals</div>,
}))
vi.mock("./pages/DaoPropose", () => ({
	default: () => <div>Dao Propose</div>,
}))
vi.mock("./pages/Dashboard", () => ({
	default: () => <div>Dashboard</div>,
}))
vi.mock("./pages/Debug", () => ({ default: () => <div>Debug</div> }))
vi.mock("./pages/Donor", () => ({ default: () => <div>Donor</div> }))
vi.mock("./pages/Home", () => ({ default: () => <div>Home</div> }))
vi.mock("./pages/Leaderboard", () => ({
	default: () => <div>Leaderboard</div>,
}))
vi.mock("./pages/Learn", () => ({ default: () => <div>Learn</div> }))
vi.mock("./pages/LessonView", () => ({
	default: () => <div>Lesson View</div>,
}))
vi.mock("./pages/NotFound", () => ({
	default: () => <div>Not Found</div>,
}))
vi.mock("./pages/Profile", () => ({ default: () => <div>Profile</div> }))
vi.mock("./pages/ScholarshipApply", () => ({
	default: () => <div>Scholarship Apply</div>,
}))
vi.mock("./pages/Treasury", () => ({
	default: () => <div>Treasury</div>,
}))

const getStaticRoutePaths = () => {
	const routePaths = Array.from(
		appSource.matchAll(/<Route\s+path="([^"]+)"/g),
		([, path]) => path,
	)

	return routePaths.filter((path) => path !== "*" && !path.includes(":"))
}

describe("App route definitions", () => {
	it("navigates /courses to the Courses page", async () => {
		render(
			<MemoryRouter initialEntries={["/courses"]}>
				<App />
			</MemoryRouter>,
		)

		expect(await screen.findByText("Courses Page")).toBeInTheDocument()
	})

	it("does not keep the dead CourseCatalog component", () => {
		expect(appSource).not.toMatch(/\b(?:const|function)\s+CourseCatalog\b/)
	})

	it("does not define duplicate static route paths", () => {
		const staticPaths = getStaticRoutePaths()
		const duplicatePaths = staticPaths.filter(
			(path, index) => staticPaths.indexOf(path) !== index,
		)

		expect(duplicatePaths).toEqual([])
		expect(staticPaths.filter((path) => path === "/courses")).toHaveLength(1)
		expect(staticPaths.filter((path) => path === "/profile")).toHaveLength(1)
		expect(staticPaths.filter((path) => path === "/debug")).toHaveLength(1)
	})
})
