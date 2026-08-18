import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ToastProvider } from "../components/Toast/ToastProvider"

vi.mock("../contracts/util", () => ({
	rpcUrl: "http://localhost:8000/rpc",
	stellarNetwork: "LOCAL",
	networkPassphrase: "Standalone Network ; February 2017",
}))

vi.mock("../lib/courseMilestoneContract", () => ({
	queryIsEnrolled: vi.fn(),
	submitEnrollTransaction: vi.fn(),
}))

vi.mock("../lib/api", () => ({
	apiFetchJson: vi.fn(),
}))

vi.mock("./useContractIds", () => ({
	useContractIds: () => ({
		courseMilestone: "CCOURSE1234567890123456789012345678901234567890",
		isDeployed: (id: string | undefined) => Boolean(id),
	}),
}))

import { apiFetchJson } from "../lib/api"
import {
	queryIsEnrolled,
	submitEnrollTransaction,
} from "../lib/courseMilestoneContract"
import {
	WalletContext,
	type WalletContextType,
} from "../providers/WalletProvider"
import { useEnrollment } from "./useEnrollment"

const COURSE_SLUG = "stellar-basics"
const WALLET = "GLEARNER1234567890123456789012345678901234567890"
const CONTRACT_ID = "CCOURSE1234567890123456789012345678901234567890"

const signTransaction = vi.fn()

function createWrapper(address?: string) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})

	const walletCtx: WalletContextType = {
		address,
		balances: {},
		isPending: false,
		isReconnecting: false,
		signTransaction,
		updateBalances: vi.fn(),
	}

	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(
			ToastProvider,
			null,
			createElement(
				QueryClientProvider,
				{ client: queryClient },
				createElement(WalletContext.Provider, { value: walletCtx }, children),
			),
		)
	}
}

function mockCourseDetailFetch(firstLessonId = 42) {
	vi.mocked(global.fetch).mockImplementation(async (input) => {
		const url = String(input)
		if (url.includes(`/api/courses/${COURSE_SLUG}`)) {
			return {
				ok: true,
				headers: { get: () => "application/json" },
				json: async () => ({
					slug: COURSE_SLUG,
					title: "Stellar Basics",
					lessons: [
						{ id: firstLessonId, order: 1, title: "Intro" },
						{ id: 99, order: 2, title: "Next" },
					],
				}),
			} as Response
		}
		if (url.includes("/api/enrollments?")) {
			return {
				ok: true,
				headers: { get: () => "application/json" },
				json: async () => ({ data: [] }),
			} as Response
		}
		throw new Error(`Unexpected fetch: ${url}`)
	})
}

beforeEach(() => {
	vi.clearAllMocks()
	global.fetch = vi.fn()
	vi.mocked(queryIsEnrolled).mockResolvedValue(false)
	vi.mocked(submitEnrollTransaction).mockResolvedValue("tx-hash-abc")
	vi.mocked(apiFetchJson).mockResolvedValue({
		enrollment_id: 1,
		enrolled_at: "2026-01-01T00:00:00.000Z",
	})
	mockCourseDetailFetch()
})

describe("useEnrollment", () => {
	it("reports not enrolled when wallet is disconnected", () => {
		const { result } = renderHook(() => useEnrollment(COURSE_SLUG), {
			wrapper: createWrapper(undefined),
		})

		expect(result.current.isEnrolled).toBe(false)
		expect(result.current.isChecking).toBe(false)
		expect(result.current.firstLessonPath).toBeNull()
	})

	it("loads persisted enrollment from the backend", async () => {
		vi.mocked(global.fetch).mockImplementation(async (input) => {
			const url = String(input)
			if (url.includes("/api/enrollments?")) {
				return {
					ok: true,
					headers: { get: () => "application/json" },
					json: async () => ({
						data: [{ course_id: COURSE_SLUG, enrollment_id: 7 }],
					}),
				} as Response
			}
			if (url.includes(`/api/courses/${COURSE_SLUG}`)) {
				return {
					ok: true,
					headers: { get: () => "application/json" },
					json: async () => ({
						slug: COURSE_SLUG,
						lessons: [{ id: 5, order: 1, title: "Intro" }],
					}),
				} as Response
			}
			throw new Error(`Unexpected fetch: ${url}`)
		})

		const { result } = renderHook(() => useEnrollment(COURSE_SLUG), {
			wrapper: createWrapper(WALLET),
		})

		await waitFor(() => {
			expect(result.current.isChecking).toBe(false)
		})

		expect(result.current.isEnrolled).toBe(true)
		expect(result.current.firstLessonPath).toBe(
			`/courses/${COURSE_SLUG}/lessons/5`,
		)
	})

	it("runs on-chain enroll, persists via POST, and resolves the first lesson path", async () => {
		const { result } = renderHook(() => useEnrollment(COURSE_SLUG), {
			wrapper: createWrapper(WALLET),
		})

		await waitFor(() => {
			expect(result.current.isChecking).toBe(false)
		})

		await act(async () => {
			const path = await result.current.enroll()
			expect(path).toBe(`/courses/${COURSE_SLUG}/lessons/42`)
		})

		expect(submitEnrollTransaction).toHaveBeenCalledWith(
			expect.objectContaining({
				contractId: CONTRACT_ID,
				learnerAddress: WALLET,
				courseId: COURSE_SLUG,
			}),
		)
		expect(apiFetchJson).toHaveBeenCalledWith("/api/enrollments", {
			method: "POST",
			auth: true,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				learner_address: WALLET,
				course_id: COURSE_SLUG,
				tx_hash: "tx-hash-abc",
			}),
		})
		expect(result.current.isEnrolled).toBe(true)
	})

	it("ignores concurrent enroll clicks while a transaction is pending", async () => {
		let resolveTx: ((hash: string) => void) | undefined
		vi.mocked(submitEnrollTransaction).mockImplementation(
			() =>
				new Promise<string>((resolve) => {
					resolveTx = resolve
				}),
		)

		const { result } = renderHook(() => useEnrollment(COURSE_SLUG), {
			wrapper: createWrapper(WALLET),
		})

		await waitFor(() => {
			expect(result.current.isChecking).toBe(false)
		})

		let firstPromise: Promise<string | null> | undefined
		let secondPromise: Promise<string | null> | undefined

		await act(async () => {
			firstPromise = result.current.enroll()
			secondPromise = result.current.enroll()
		})

		expect(submitEnrollTransaction).toHaveBeenCalledTimes(1)

		await act(async () => {
			resolveTx?.("tx-hash-abc")
			await Promise.all([firstPromise, secondPromise])
		})
	})

	it("surfaces wallet rejection without calling the persistence API", async () => {
		const rejection = Object.assign(new Error("User rejected"), {
			code: "USER_REJECTED",
		})
		vi.mocked(submitEnrollTransaction).mockRejectedValue(rejection)

		const { result } = renderHook(() => useEnrollment(COURSE_SLUG), {
			wrapper: createWrapper(WALLET),
		})

		await waitFor(() => {
			expect(result.current.isChecking).toBe(false)
		})

		await act(async () => {
			const path = await result.current.enroll()
			expect(path).toBeNull()
		})

		await waitFor(() => {
			expect(result.current.error).toMatch(/cancel/i)
		})

		expect(apiFetchJson).not.toHaveBeenCalled()
	})

	it("keeps on-chain progress and allows persistence retry after API failure", async () => {
		vi.mocked(queryIsEnrolled).mockResolvedValue(false)
		vi.mocked(submitEnrollTransaction).mockResolvedValue("tx-hash-onchain")
		vi.mocked(apiFetchJson).mockRejectedValueOnce(new Error("API unavailable"))

		const { result } = renderHook(() => useEnrollment(COURSE_SLUG), {
			wrapper: createWrapper(WALLET),
		})

		await waitFor(() => {
			expect(result.current.isChecking).toBe(false)
		})

		await act(async () => {
			const path = await result.current.enroll()
			expect(path).toBeNull()
		})

		expect(submitEnrollTransaction).toHaveBeenCalledTimes(1)
		expect(result.current.needsPersistence).toBe(true)

		vi.mocked(queryIsEnrolled).mockResolvedValue(true)
		vi.mocked(apiFetchJson).mockResolvedValueOnce({
			enrollment_id: 2,
			enrolled_at: "2026-01-02T00:00:00.000Z",
		})

		await act(async () => {
			const path = await result.current.retryPersistence()
			expect(path).toBe(`/courses/${COURSE_SLUG}/lessons/42`)
		})

		expect(submitEnrollTransaction).toHaveBeenCalledTimes(1)
		expect(result.current.isEnrolled).toBe(true)
		expect(result.current.needsPersistence).toBe(false)
	})

	it("skips a new on-chain enroll when already enrolled on-chain and only persists", async () => {
		vi.mocked(queryIsEnrolled).mockResolvedValue(true)

		const { result } = renderHook(() => useEnrollment(COURSE_SLUG), {
			wrapper: createWrapper(WALLET),
		})

		await waitFor(() => {
			expect(result.current.isChecking).toBe(false)
		})

		await act(async () => {
			const path = await result.current.enroll()
			expect(path).toBe(`/courses/${COURSE_SLUG}/lessons/42`)
		})

		expect(submitEnrollTransaction).not.toHaveBeenCalled()
		expect(apiFetchJson).toHaveBeenCalledWith("/api/enrollments", {
			method: "POST",
			auth: true,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				learner_address: WALLET,
				course_id: COURSE_SLUG,
				tx_hash: "on-chain-existing",
			}),
		})
	})
})
