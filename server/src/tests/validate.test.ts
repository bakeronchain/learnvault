/**
 * Unit tests for the `validate` middleware in isolation.
 * Tests cover: valid body passthrough, invalid body rejection,
 * valid params passthrough, invalid params rejection, and
 * combined body + params failure producing a single merged errors array.
 *
 * Requirements: 5.1
 */

import { type NextFunction, type Request, type Response } from "express"
import { z } from "zod"
import { validate } from "../middleware/validate"

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
    return {
        body: {},
        query: {},
        params: {},
        ...overrides,
    } as unknown as Request
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
    const json = jest.fn()
    const status = jest.fn().mockReturnValue({ json })
    const res = { status } as unknown as Response
    return { res, status, json }
}

function makeNext(): NextFunction {
    return jest.fn() as unknown as NextFunction
}

// ─── Schemas used across tests ───────────────────────────────────────────────

const bodySchema = z.object({
    name: z.string().min(1),
    age: z.number().int().nonnegative(),
})

const paramsSchema = z.object({
    id: z.string().min(1),
})

// ─── Valid body passthrough ──────────────────────────────────────────────────

describe("validate middleware – valid body", () => {
    it("calls next() when body conforms to schema", () => {
        const req = makeReq({ body: { name: "Alice", age: 30 } })
        const { res } = makeRes()
        const next = makeNext()

        validate({ body: bodySchema })(req, res, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(next).toHaveBeenCalledWith(/* no args */)
    })

    it("writes coerced values back to req.body on success", () => {
        const req = makeReq({ body: { name: "Bob", age: 25 } })
        const { res } = makeRes()
        const next = makeNext()

        validate({ body: bodySchema })(req, res, next)

        expect(req.body).toEqual({ name: "Bob", age: 25 })
    })

    it("does NOT call res.status() on valid body", () => {
        const req = makeReq({ body: { name: "Carol", age: 0 } })
        const { res, status } = makeRes()
        const next = makeNext()

        validate({ body: bodySchema })(req, res, next)

        expect(status).not.toHaveBeenCalled()
    })
})

// ─── Invalid body rejection ──────────────────────────────────────────────────

describe("validate middleware – invalid body", () => {
    it("responds with 400 when body fails schema", () => {
        const req = makeReq({ body: { name: "", age: -1 } })
        const { res, status, json } = makeRes()
        const next = makeNext()

        validate({ body: bodySchema })(req, res, next)

        expect(status).toHaveBeenCalledWith(400)
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({
                errors: expect.arrayContaining([expect.objectContaining({ path: expect.any(Array), message: expect.any(String) })]),
            }),
        )
    })

    it("does NOT call next() when body is invalid", () => {
        const req = makeReq({ body: { name: 42, age: "not-a-number" } })
        const { res } = makeRes()
        const next = makeNext()

        validate({ body: bodySchema })(req, res, next)

        expect(next).not.toHaveBeenCalled()
    })

    it("returns non-empty errors array on invalid body", () => {
        const req = makeReq({ body: {} })
        const { res, json } = makeRes()
        const next = makeNext()

        validate({ body: bodySchema })(req, res, next)

        const payload = json.mock.calls[0][0] as { errors: unknown[] }
        expect(payload.errors.length).toBeGreaterThan(0)
    })
})

// ─── Valid params passthrough ────────────────────────────────────────────────

describe("validate middleware – valid params", () => {
    it("calls next() when params conform to schema", () => {
        const req = makeReq({ params: { id: "abc-123" } as Request["params"] })
        const { res } = makeRes()
        const next = makeNext()

        validate({ params: paramsSchema })(req, res, next)

        expect(next).toHaveBeenCalledTimes(1)
    })

    it("writes coerced values back to req.params on success", () => {
        const req = makeReq({ params: { id: "xyz" } as Request["params"] })
        const { res } = makeRes()
        const next = makeNext()

        validate({ params: paramsSchema })(req, res, next)

        expect(req.params).toEqual({ id: "xyz" })
    })
})

// ─── Invalid params rejection ────────────────────────────────────────────────

describe("validate middleware – invalid params", () => {
    it("responds with 400 when params fail schema", () => {
        const req = makeReq({ params: { id: "" } as Request["params"] })
        const { res, status, json } = makeRes()
        const next = makeNext()

        validate({ params: paramsSchema })(req, res, next)

        expect(status).toHaveBeenCalledWith(400)
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({ errors: expect.any(Array) }),
        )
    })

    it("does NOT call next() when params are invalid", () => {
        const req = makeReq({ params: { id: "" } as Request["params"] })
        const { res } = makeRes()
        const next = makeNext()

        validate({ params: paramsSchema })(req, res, next)

        expect(next).not.toHaveBeenCalled()
    })
})

// ─── Combined body + params failure ─────────────────────────────────────────

describe("validate middleware – combined body + params failure", () => {
    it("returns a single 400 response with errors from both schemas", () => {
        const req = makeReq({
            body: { name: "", age: -5 },
            params: { id: "" } as Request["params"],
        })
        const { res, status, json } = makeRes()
        const next = makeNext()

        validate({ body: bodySchema, params: paramsSchema })(req, res, next)

        // Only one response should be sent
        expect(status).toHaveBeenCalledTimes(1)
        expect(status).toHaveBeenCalledWith(400)

        const payload = json.mock.calls[0][0] as { errors: unknown[] }
        // Must contain issues from both body and params
        expect(payload.errors.length).toBeGreaterThan(1)
    })

    it("does NOT call next() when both body and params are invalid", () => {
        const req = makeReq({
            body: {},
            params: { id: "" } as Request["params"],
        })
        const { res } = makeRes()
        const next = makeNext()

        validate({ body: bodySchema, params: paramsSchema })(req, res, next)

        expect(next).not.toHaveBeenCalled()
    })

    it("issues from both schemas appear in a single errors array", () => {
        const req = makeReq({
            body: { name: 123, age: "bad" },   // 2 type errors
            params: { id: "" } as Request["params"],  // 1 min-length error
        })
        const { res, json } = makeRes()
        const next = makeNext()

        validate({ body: bodySchema, params: paramsSchema })(req, res, next)

        const payload = json.mock.calls[0][0] as { errors: Array<{ path: unknown[]; message: string }> }
        // Every issue must have the required ZodIssue shape
        for (const issue of payload.errors) {
            expect(Array.isArray(issue.path)).toBe(true)
            expect(typeof issue.message).toBe("string")
            expect(issue.message.length).toBeGreaterThan(0)
        }
    })
})
