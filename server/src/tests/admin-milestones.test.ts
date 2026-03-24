/**
 * Integration tests for the admin milestone verification API.
 * Uses the in-memory store so no database is required.
 */

import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { adminMilestonesRouter } from "../routes/admin-milestones.routes";
import { inMemoryMilestoneStore } from "../db/milestone-store";

const JWT_SECRET = "learnvault-secret";

function makeAdminToken(address = "GADMIN123") {
  return jwt.sign({ address }, JWT_SECRET, { expiresIn: "1h" });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", adminMilestonesRouter);
  return app;
}

// Reset in-memory store before each test
beforeEach(() => {
  // @ts-ignore – reset private fields for test isolation
  inMemoryMilestoneStore["reports"] = [];
  // @ts-ignore
  inMemoryMilestoneStore["auditLog"] = [];
  // @ts-ignore
  inMemoryMilestoneStore["reportSeq"] = 1;
  // @ts-ignore
  inMemoryMilestoneStore["auditSeq"] = 1;
});

describe("POST /api/milestones/submit", () => {
  it("creates a report with valid payload", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/milestones/submit")
      .send({
        scholarAddress: "GSCHOLAR1",
        courseId: "stellar-basics",
        milestoneId: 1,
        evidenceDescription: "Completed all exercises",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.scholar_address).toBe("GSCHOLAR1");
  });

  it("rejects submission with no evidence", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/milestones/submit")
      .send({
        scholarAddress: "GSCHOLAR1",
        courseId: "stellar-basics",
        milestoneId: 1,
      });

    expect(res.status).toBe(400);
  });

  it("returns 409 on duplicate submission", async () => {
    const app = buildApp();
    const payload = {
      scholarAddress: "GSCHOLAR1",
      courseId: "stellar-basics",
      milestoneId: 1,
      evidenceDescription: "First attempt",
    };

    await request(app).post("/api/milestones/submit").send(payload);
    const res = await request(app).post("/api/milestones/submit").send(payload);

    expect(res.status).toBe(409);
  });
});

describe("GET /api/admin/milestones/pending", () => {
  it("returns 401 without token", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/admin/milestones/pending");
    expect(res.status).toBe(401);
  });

  it("returns pending reports for admin", async () => {
    // Seed a report
    await inMemoryMilestoneStore["createReport"]({
      scholar_address: "GSCHOLAR1",
      course_id: "stellar-basics",
      milestone_id: 1,
      evidence_description: "Done",
      evidence_github: null,
      evidence_ipfs_cid: null,
    });

    const app = buildApp();
    const res = await request(app)
      .get("/api/admin/milestones/pending")
      .set("Authorization", `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe("pending");
  });
});

describe("GET /api/admin/milestones/:id", () => {
  it("returns 404 for unknown id", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/admin/milestones/999")
      .set("Authorization", `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(404);
  });

  it("returns report with audit log", async () => {
    const report = await inMemoryMilestoneStore["createReport"]({
      scholar_address: "GSCHOLAR1",
      course_id: "stellar-basics",
      milestone_id: 1,
      evidence_description: "Done",
      evidence_github: null,
      evidence_ipfs_cid: null,
    });

    const app = buildApp();
    const res = await request(app)
      .get(`/api/admin/milestones/${report.id}`)
      .set("Authorization", `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(report.id);
    expect(Array.isArray(res.body.data.auditLog)).toBe(true);
  });
});

describe("POST /api/admin/milestones/:id/approve", () => {
  it("approves a pending report and records audit entry", async () => {
    const report = await inMemoryMilestoneStore["createReport"]({
      scholar_address: "GSCHOLAR1",
      course_id: "stellar-basics",
      milestone_id: 1,
      evidence_description: "Done",
      evidence_github: null,
      evidence_ipfs_cid: null,
    });

    const app = buildApp();
    const res = await request(app)
      .post(`/api/admin/milestones/${report.id}/approve`)
      .set("Authorization", `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("approved");
    expect(res.body.data.auditEntry.decision).toBe("approved");
    expect(res.body.data.auditEntry.validator_address).toBe("GADMIN123");
  });

  it("returns 409 when approving an already-approved report", async () => {
    const report = await inMemoryMilestoneStore["createReport"]({
      scholar_address: "GSCHOLAR1",
      course_id: "stellar-basics",
      milestone_id: 1,
      evidence_description: "Done",
      evidence_github: null,
      evidence_ipfs_cid: null,
    });
    await inMemoryMilestoneStore.updateReportStatus(report.id, "approved");

    const app = buildApp();
    const res = await request(app)
      .post(`/api/admin/milestones/${report.id}/approve`)
      .set("Authorization", `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(409);
  });
});

describe("POST /api/admin/milestones/:id/reject", () => {
  it("rejects a pending report with a reason", async () => {
    const report = await inMemoryMilestoneStore["createReport"]({
      scholar_address: "GSCHOLAR1",
      course_id: "stellar-basics",
      milestone_id: 1,
      evidence_description: "Done",
      evidence_github: null,
      evidence_ipfs_cid: null,
    });

    const app = buildApp();
    const res = await request(app)
      .post(`/api/admin/milestones/${report.id}/reject`)
      .set("Authorization", `Bearer ${makeAdminToken()}`)
      .send({ reason: "Evidence is insufficient" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("rejected");
    expect(res.body.data.reason).toBe("Evidence is insufficient");
    expect(res.body.data.auditEntry.rejection_reason).toBe("Evidence is insufficient");
  });

  it("returns 400 when reason is missing", async () => {
    const report = await inMemoryMilestoneStore["createReport"]({
      scholar_address: "GSCHOLAR1",
      course_id: "stellar-basics",
      milestone_id: 1,
      evidence_description: "Done",
      evidence_github: null,
      evidence_ipfs_cid: null,
    });

    const app = buildApp();
    const res = await request(app)
      .post(`/api/admin/milestones/${report.id}/reject`)
      .set("Authorization", `Bearer ${makeAdminToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });
});
