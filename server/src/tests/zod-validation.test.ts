/**
 * Integration tests for Zod validation middleware applied to routes.
 *
 * Covers:
 *   - POST /api/validator/validate  (Requirements 5.2, 5.3)
 *   - POST /api/comments            (Requirements 5.4, 5.5)
 *   - PUT  /api/comments/:id/vote   (Requirements 5.6, 5.7)
 *   - POST /api/milestones/submit   (Requirements 5.8, 5.9)
 */

import express, { type Request, type Response, type NextFunction } from "express"
import request from "supertest"
import { AppError } from "../errors/app-error-handler"

// ─── Minimal error handler that respects AppError.statusCode ────────────────
function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
) {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message })
    } else {
        res.status(500).json({ error: "Internal Server Error" })
    }
}

// ─── POST /api/validator/validate ───────────────────────────────────────────

describe("POST /api/validator/validate", () => {
    async function buildApp() {
        const { validatorRouter } = await import("../routes/validator.routes")
        const app = express()
        app.use(express.json())
        app.use("/api", validatorRouter)
        app.use(errorHandler)
        return app
    }

    it("valid payload → 200 with approved result", async () => {
        const app = await buildApp()
        const res = await request(app)
            .post("/api/validator/validate")
            .send({ courseId: "clxxxxxxxxxxxxxxxxxxxxxxxx", learnerAddress: "GABC", milestoneId: 1 })

        expect(res.status).toBe(200)
        expect(res.body.data.approved).toBe(true)
    })

    it("missing milestoneId → 400 with errors array", async () => {
        const app = await buildApp()
        const res = await request(app)
            .post("/api/validator/validate")
            .send({ courseId: "clxxxxxxxxxxxxxxxxxxxxxxxx", learnerAddress: "GABC" })

        expect(res.status).toBe(400)
        expect(Array.isArray(res.body.errors)).toBe(true)
        expect(res.body.errors.length).toBeGreaterThan(0)
    })
})

// ─── POST /api/comments ─────────────────────────────────────────────────────
// The comments route requires auth middleware. We stub it out here.

describe("POST /api/comments", () => {
    function buildApp() {
        const app = express()
        app.use(express.json())

        // Inject a fake auth user so authMiddleware is bypassed
        app.use((req: Request, _res: Response, next: NextFunction) => {
            ; (req as Request & { user?: { address: string } }).user = {
                address: "GTEST",
            }
            next()
        })

        // Mount only the validate middleware + a stub controller
        const { validate } = require("../middleware/validate")
        const { postCommentBodySchema } = require("../lib/zod-schemas")

        app.post(
            "/api/comments",
            validate({ body: postCommentBodySchema }),
            (_req: Request, res: Response) => {
                res.status(201).json({ id: "1", ..._req.body })
            },
        )
        app.use(errorHandler)
        return app
    }

    it("valid body → 201 with created comment fields", async () => {
        const app = buildApp()
        const res = await request(app)
            .post("/api/comments")
            .send({ proposalId: "prop-1", content: "Nice proposal!" })

        expect(res.status).toBe(201)
        expect(res.body.proposalId).toBe("prop-1")
    })

    it("missing content → 400 with errors array", async () => {
        const app = buildApp()
        const res = await request(app)
            .post("/api/comments")
            .send({ proposalId: "prop-1" })

        expect(res.status).toBe(400)
        expect(Array.isArray(res.body.errors)).toBe(true)
        const paths = res.body.errors.map((e: { path: string[] }) =>
            e.path.join("."),
        )
        expect(paths).toContain("content")
    })
})

// ─── PUT /api/comments/:id/vote ──────────────────────────────────────────────

describe("PUT /api/comments/:id/vote", () => {
    function buildApp() {
        const app = express()
        app.use(express.json())

        const { validate } = require("../middleware/validate")
        const { voteCommentBodySchema } = require("../lib/zod-schemas")

        app.put(
            "/api/comments/:id/vote",
            validate({ body: voteCommentBodySchema }),
            (_req: Request, res: Response) => {
                res.status(200).json({ ok: true })
            },
        )
        app.use(errorHandler)
        return app
    }

    it("valid type 'upvote' → 200", async () => {
        const app = buildApp()
        const res = await request(app)
            .put("/api/comments/42/vote")
            .send({ type: "upvote" })

        expect(res.status).toBe(200)
    })

    it("valid type 'downvote' → 200", async () => {
        const app = buildApp()
        const res = await request(app)
            .put("/api/comments/42/vote")
            .send({ type: "downvote" })

        expect(res.status).toBe(200)
    })

    it("invalid type 'like' → 400 with errors array", async () => {
        const app = buildApp()
        const res = await request(app)
            .put("/api/comments/42/vote")
            .send({ type: "like" })

        expect(res.status).toBe(400)
        expect(Array.isArray(res.body.errors)).toBe(true)
        const paths = res.body.errors.map((e: { path: string[] }) =>
            e.path.join("."),
        )
        expect(paths).toContain("type")
    })
})

// ─── POST /api/milestones/submit ─────────────────────────────────────────────

describe("POST /api/milestones/submit", () => {
    function buildApp() {
        const app = express()
        app.use(express.json())

        const { validate } = require("../middleware/validate")
        const { submitMilestoneBodySchema } = require("../lib/zod-schemas")

        app.post(
            "/api/milestones/submit",
            validate({ body: submitMilestoneBodySchema }),
            (_req: Request, res: Response) => {
                res.status(201).json({ status: "pending", ..._req.body })
            },
        )
        app.use(errorHandler)
        return app
    }

    const validBase = {
        scholarAddress: "GSCHOLAR1",
        courseId: "stellar-basics",
        milestoneId: 1,
    }

    it("valid payload with evidenceDescription → 201", async () => {
        const app = buildApp()
        const res = await request(app)
            .post("/api/milestones/submit")
            .send({ ...validBase, evidenceDescription: "Completed exercises" })

        expect(res.status).toBe(201)
        expect(res.body.status).toBe("pending")
    })

    it("valid payload with evidenceGithub → 201", async () => {
        const app = buildApp()
        const res = await request(app)
            .post("/api/milestones/submit")
            .send({ ...validBase, evidenceGithub: "https://github.com/user/repo" })

        expect(res.status).toBe(201)
    })

    it("missing all evidence fields → 400 with errors array", async () => {
        const app = buildApp()
        const res = await request(app)
            .post("/api/milestones/submit")
            .send(validBase)

        expect(res.status).toBe(400)
        expect(Array.isArray(res.body.errors)).toBe(true)
        expect(res.body.errors.length).toBeGreaterThan(0)
    })

    it("missing scholarAddress → 400", async () => {
        const app = buildApp()
        const res = await request(app)
            .post("/api/milestones/submit")
            .send({ courseId: "stellar-basics", milestoneId: 1, evidenceDescription: "done" })

        expect(res.status).toBe(400)
    })
})
