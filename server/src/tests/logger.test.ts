import { sanitizeForLogging } from "../lib/logger"

describe("sanitizeForLogging", () => {
	const previousNodeEnv = process.env.NODE_ENV

	afterEach(() => {
		process.env.NODE_ENV = previousNodeEnv
	})

	it("omits stack traces from error payloads in production", () => {
		process.env.NODE_ENV = "production"

		const error = new Error("boom")
		const sanitized = sanitizeForLogging({ error }) as {
			error: Record<string, unknown>
		}

		expect(sanitized.error.message).toBe("boom")
		expect(sanitized.error.stack).toBeUndefined()
	})

	it("keeps stack traces in non-production environments", () => {
		process.env.NODE_ENV = "development"

		const error = new Error("boom")
		const sanitized = sanitizeForLogging({ error }) as {
			error: Record<string, unknown>
		}

		expect(sanitized.error.message).toBe("boom")
		expect(sanitized.error.stack).toEqual(expect.any(String))
	})

	it("sanitizes nested error objects recursively", () => {
		process.env.NODE_ENV = "production"

		const error = new Error("nested")
		const sanitized = sanitizeForLogging({
			requestId: "req-123",
			context: { error },
		}) as {
			context: { error: Record<string, unknown> }
		}

		expect(sanitized.context.error.message).toBe("nested")
		expect(sanitized.context.error.stack).toBeUndefined()
	})
})
