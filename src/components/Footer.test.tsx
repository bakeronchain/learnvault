import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "../test/setup"
import Footer from "./Footer"

vi.mock("./LanguageSelector", () => ({
	LanguageSelector: () => <div data-testid="language-selector" />,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"nav.github": "GitHub",
				"nav.twitter": "Twitter",
				"nav.discord": "Discord",
			}
			return translations[key] ?? key
		},
		i18n: { changeLanguage: vi.fn() },
	}),
}))

describe("Footer component", () => {
	it("renders all social media links", () => {
		render(
			<MemoryRouter>
				<Footer />
			</MemoryRouter>,
		)

		const githubLink = screen.getByRole("link", { name: /github/i })
		const twitterLink = screen.getByRole("link", { name: /twitter/i })
		const discordLink = screen.getByRole("link", { name: /discord/i })

		expect(githubLink).toBeInTheDocument()
		expect(twitterLink).toBeInTheDocument()
		expect(discordLink).toBeInTheDocument()
	})

	it("external links open in new tab", () => {
		render(
			<MemoryRouter>
				<Footer />
			</MemoryRouter>,
		)

		const links = screen.getAllByRole("link")
		const externalLinks = links.filter((link) =>
			link.getAttribute("href")?.startsWith("http"),
		)

		externalLinks.forEach((link) => {
			expect(link).toHaveAttribute("target", "_blank")
			expect(link).toHaveAttribute("rel", "noopener noreferrer")
		})
	})

	it("social media links point to correct URLs", () => {
		render(
			<MemoryRouter>
				<Footer />
			</MemoryRouter>,
		)

		expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute(
			"href",
			"https://github.com/bakeronchain/learnvault",
		)
		expect(screen.getByRole("link", { name: /twitter/i })).toHaveAttribute(
			"href",
			"https://twitter.com/LearnVaultDAO",
		)
		expect(screen.getByRole("link", { name: /discord/i })).toHaveAttribute(
			"href",
			"https://discord.gg/learnvault",
		)
	})

	it("displays the current copyright year", () => {
		render(
			<MemoryRouter>
				<Footer />
			</MemoryRouter>,
		)

		const currentYear = new Date().getFullYear().toString()
		expect(screen.getByText(new RegExp(currentYear))).toBeInTheDocument()
	})

	it("renders the LearnVault brand name", () => {
		render(
			<MemoryRouter>
				<Footer />
			</MemoryRouter>,
		)

		const matches = screen.getAllByText(/learnvault/i)
		expect(matches.length).toBeGreaterThan(0)
	})

	it("renders footer nav with aria-label", () => {
		render(
			<MemoryRouter>
				<Footer />
			</MemoryRouter>,
		)

		expect(
			screen.getByRole("navigation", { name: /footer/i }),
		).toBeInTheDocument()
	})

	it("renders Powered by Soroban badge", () => {
		render(
			<MemoryRouter>
				<Footer />
			</MemoryRouter>,
		)

		expect(screen.getByText(/powered by soroban/i)).toBeInTheDocument()
	})

	it("renders language selector for mobile layout", () => {
		render(
			<MemoryRouter>
				<Footer />
			</MemoryRouter>,
		)

		expect(screen.getByTestId("language-selector")).toBeInTheDocument()
	})

	it("copyright text includes LearnVault DAO", () => {
		render(
			<MemoryRouter>
				<Footer />
			</MemoryRouter>,
		)

		expect(screen.getByText(/learnvault dao/i)).toBeInTheDocument()
	})
})
