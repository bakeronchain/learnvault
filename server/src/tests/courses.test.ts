/**
 * Unit tests for GET /api/courses cursor-based pagination.
 */

import express, { type Request, type Response, type NextFunction } from "express"
import request from "supertest"
import { coursesRouter } from "../routes/courses.routes"
import { AppError } from "../errors/app-error-handler"

function buildApp() {
    const app = express()
    app.use(express.json())
    app.use("/api", coursesRouter)
    // Error handler that respects AppError.statusCode
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof AppError) {
            res
                .status(err.statusCode)
                .json({ error: err.message, details: err.details })
        } else {
            res.status(500).json({ error: "Internal Server Error" })
        }
    })
    return app
}

describe("GET /api/courses – cursor pagination", () => {
    it("first page: returns up to limit courses with nextCursor when more exist", async () => {
        const app = buildApp()
        const res = await request(app).get("/api/courses?limit=1")

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.nextCursor).not.toBeNull()
        expect(typeof res.body.nextCursor).toBe("string")
    })

    it("middle page: cursor advances correctly and does not repeat items", async () => {
        const app = buildApp()

        const first = await request(app).get("/api/courses?limit=1")
        expect(first.status).toBe(200)
        const cursor = first.body.nextCursor

        const second = await request(app).get(
            `/api/courses?limit=1&cursor=${cursor}`,
        )

        expect(second.status).toBe(200)
        expect(second.body.data).toHaveLength(1)
        expect(second.body.data[0].id).not.toBe(first.body.data[0].id)
    })

    it("last page: nextCursor is null when no more pages remain", async () => {
        const app = buildApp()

        const res = await request(app).get("/api/courses?limit=100")

        expect(res.status).toBe(200)
        expect(res.body.nextCursor).toBeNull()
    })

    it("returns 400 when limit exceeds 100", async () => {
        const app = buildApp()
        const res = await request(app).get("/api/courses?limit=101")

        expect(res.status).toBe(400)
    })

    it("returns 400 for a cursor referencing an unknown id", async () => {
        const app = buildApp()
        // Encode a valid base64url string that doesn't match any course id
        const badCursor = Buffer.from("nonexistent-course").toString("base64url")
        const res = await request(app).get(`/api/courses?cursor=${badCursor}`)

        expect(res.status).toBe(400)
    })

    it("default limit applies when no params are given", async () => {
        const app = buildApp()
        const res = await request(app).get("/api/courses")

        expect(res.status).toBe(200)
        expect(Array.isArray(res.body.data)).toBe(true)
        expect("nextCursor" in res.body).toBe(true)
    })
})
