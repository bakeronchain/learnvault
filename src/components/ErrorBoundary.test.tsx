import { type ErrorInfo } from "react"
import { describe, expect, it, vi } from "vitest"
import ErrorBoundary from "./ErrorBoundary"

describe("ErrorBoundary", () => {
	it("getDerivedStateFromError sets hasError=true and stores the error", () => {
		const error = new Error("boom")
		const state = ErrorBoundary.getDerivedStateFromError(error)
		expect(state).toEqual({ hasError: true, error })
	})

	it("handleRetry resets state so the child tree re-renders", () => {
		const boundary = new ErrorBoundary({})
		boundary.state = { hasError: true, error: new Error("boom") }

		const setState = vi.fn((next) => Object.assign(boundary.state, next))
		boundary.setState = setState
		;(boundary as unknown as { handleRetry(): void }).handleRetry()

		expect(setState).toHaveBeenCalledWith({ hasError: false, error: null })
		expect(boundary.state.hasError).toBe(false)
		expect(boundary.state.error).toBeNull()
	})

	it("componentDidCatch logs the error", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {})
		const boundary = new ErrorBoundary({})
		const error = new Error("caught")
		const info = { componentStack: "\n  in Child" } as ErrorInfo

		boundary.componentDidCatch(error, info)

		expect(spy).toHaveBeenCalledWith("Uncaught error:", error, info)
		spy.mockRestore()
	})
})
