import express from "express";
import request from "supertest";
import { treasuryRouter } from "../routes/treasury.routes";
import { errorHandler } from "../middleware/error.middleware";

// Mock rpc.Server and scValToNative
const mockGetEvents = jest.fn();
jest.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: jest.fn().mockImplementation(() => ({
      getEvents: mockGetEvents,
    })),
  },
  scValToNative: jest.fn((val) => val),
}));

import { scValToNative } from "@stellar/stellar-sdk";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", treasuryRouter);
  app.use(errorHandler);
  return app;
}

describe("Treasury Routes", () => {
  const contractId = "CCONTR123";

  beforeAll(() => {
    process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID = contractId;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/treasury/stats", () => {
    it("returns 503 if contract ID is missing", async () => {
      const originalId = process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID;
      delete process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID;
      
      const res = await request(buildApp()).get("/api/treasury/stats");
      expect(res.status).toBe(503);
      expect(res.body.error).toBe("Treasury contract not configured");
      
      process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID = originalId;
    });

    it("returns stats calculated from events", async () => {
      // Mock scValToNative to handle topics and value
      (scValToNative as jest.Mock).mockImplementation((val) => val);

      mockGetEvents.mockResolvedValue({
        events: [
          {
            topic: ["deposit"],
            value: { amount: 1000, donor: "G_DONOR_1" },
          },
          {
            topic: ["disburse"],
            value: { amount: 500, scholar: "G_SCHOLAR_1" },
          },
          {
            topic: ["proposal_submitted"],
            value: {},
          },
        ],
      });

      const res = await request(buildApp()).get("/api/treasury/stats");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        total_deposited_usdc: "1000",
        total_disbursed_usdc: "500",
        scholars_funded: 1,
        active_proposals: 1,
        donors_count: 1,
      });
    });

    it("returns 500 on RPC error", async () => {
      mockGetEvents.mockRejectedValue(new Error("RPC failure"));
      const res = await request(buildApp()).get("/api/treasury/stats");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch treasury statistics");
    });
  });

  describe("GET /api/treasury/activity", () => {
    it("returns list of activity events sorted by date", async () => {
      mockGetEvents.mockResolvedValue({
        events: [
          {
            topic: ["deposit"],
            value: { amount: 100 },
            txHash: "tx1",
            ledgerClosedAt: "2024-01-01T10:00:00Z",
          },
          {
            topic: ["disburse"],
            value: { amount: 50, scholar: "S1" },
            txHash: "tx2",
            ledgerClosedAt: "2024-01-01T11:00:00Z",
          },
        ],
      });

      const res = await request(buildApp())
        .get("/api/treasury/activity")
        .query({ limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(2);
      // Sorted by date desc
      expect(res.body.events[0].tx_hash).toBe("tx2");
      expect(res.body.events[1].tx_hash).toBe("tx1");
    });

    it("applies limit and offset", async () => {
      const manyEvents = Array.from({ length: 10 }, (_, i) => ({
        topic: ["deposit"],
        value: { amount: i },
        txHash: `tx${i}`,
        ledgerClosedAt: `2024-01-01T10:00:0${i}Z`,
      }));

      mockGetEvents.mockResolvedValue({
        events: manyEvents,
      });

      const res = await request(buildApp())
        .get("/api/treasury/activity")
        .query({ limit: 2, offset: 1 });

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(2);
      // Total 10 events, offset 1 should give the 2nd and 3rd most recent
      // (tx8, tx7)
      expect(res.body.events[0].tx_hash).toBe("tx8");
      expect(res.body.events[1].tx_hash).toBe("tx7");
    });
  });
});
