import { type ReactNode } from "react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import GlobalSearch from "../components/GlobalSearch"

const mockNavigate = vi.fn()

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
	return {
		...actual,
		useNavigate: () => mockNavigate,
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) =>
			key + (params ? ` ${JSON.stringify(params)}` : ""),
	}),
}))

vi.mock("../lib/api", () => ({
	API_URL: "http://test.local",
}))

let fetchCalls = 0

function mockFetchWithResults(results: unknown[] = []) {
	vi.stubGlobal(
		"fetch",
		vi.fn(() => {
			fetchCalls += 1
			return Promise.resolve({
				ok: true,
				json: async () => ({
					data: [
						{
							type: "course",
							id: "1",
							title: "Milestone escrow",
							snippet: "…<mark>escrow</mark>…",
							url: "/courses/escrow",
						},
					],
					nextCursor: null,
				}),
			})
		})
	)
}

function renderSearch() {
	return render(
		<MemoryRouter>
			<GlobalSearch />
		</MemoryRouter>
	)
}

describe("GlobalSearch", () => {
	beforeEach(() => {
		fetchCalls = 0
		localStorage.clear()
		mockFetchWithResults()
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		localStorage.clear()
	})

	async function typeQuery(value: string) {
		const user = userEvent.setup()
		await user.type(screen.getByRole("combobox"), value)
		return user
	}

	it("renders the empty state when a search returns no results", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => {
				fetchCalls += 1
				return Promise.resolve({
					ok: true,
					json: async () => ({ data: [], nextCursor: null }),
				})
			})
		)
		renderSearch()
		await typeQuery("zzzznothing")

		await waitFor(() => expect(fetchCalls).toBeGreaterThanOrEqual(1))
		// The empty state renders immediately while results are pending.
		expect(screen.getAllByText(/search\.no_results/).length).toBeGreaterThan(0)
	})

	it("fires a request once the debounce settles", async () => {
		renderSearch()
		await typeQuery("escrow")

		await waitFor(() => expect(fetchCalls).toBeGreaterThanOrEqual(1), { timeout: 3000 })
		const calledUrl = String(vi.mocked(fetch).mock.calls[0][0])
		expect(calledUrl).toContain("/api/search")
		expect(calledUrl).toContain("q=escrow")
	})

	it("does not query until two characters are typed", async () => {
		renderSearch()
		await typeQuery("e")

		await new Promise((r) => setTimeout(r, 500))
		expect(fetchCalls).toBe(0)

		await typeQuery("s")
		await waitFor(() => expect(fetchCalls).toBeGreaterThanOrEqual(1), { timeout: 3000 })
	}, 10000)

	it("aborts the in-flight request when the user retypes", async () => {
		const abortedFlags: boolean[] = []
		vi.stubGlobal(
			"fetch",
			vi.fn((_input: any, init?: { signal?: AbortSignal }) => {
				fetchCalls += 1
				const index = abortedFlags.push(false) - 1
				return new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						abortedFlags[index] = true
						reject(new Error("AbortError"))
					})
					// Never resolves on its own — only abort settles it.
				})
			})
		)

		renderSearch()
		await typeQuery("escro")
		await new Promise((r) => setTimeout(r, 450))
		expect(fetchCalls).toBeGreaterThanOrEqual(1)

		await typeQuery("w") // retype → debounced query changes → previous must abort
		await waitFor(() => expect(abortedFlags[0]).toBe(true), { timeout: 3000 })
	}, 10000)

	it("navigates through results with arrow keys and selects with Enter", async () => {
		renderSearch()
		await typeQuery("escrow")

		const input = (await waitFor(() => {
			const el = screen.getByRole("combobox")
			expect(screen.getAllByRole("option").length).toBeGreaterThan(0)
			return el
		})) as HTMLInputElement

		const user = userEvent.setup()
		input.focus()
		await user.keyboard("{ArrowDown}")
		await waitFor(() =>
			expect(input.getAttribute("aria-activedescendant")).toContain("search-option-")
		)

		await user.keyboard("{Enter}")
		await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/courses/escrow"))
	}, 10000)

	it("stores submitted searches as recent searches", async () => {
		renderSearch()
		const input = screen.getByRole("combobox")
		const user = userEvent.setup()
		await user.type(input, "soroban")

		await waitFor(() => expect(fetchCalls).toBeGreaterThanOrEqual(1), { timeout: 3000 })
		input.focus()
		await user.keyboard("{Enter}")

		await waitFor(() => {
			const recent = JSON.parse(localStorage.getItem("learnvault:recent-searches") ?? "[]")
			expect(recent).toContain("soroban")
		})
	}, 10000)
})
