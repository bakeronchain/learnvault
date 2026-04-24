import express from "express";
import request from "supertest";
import { createAuthRouter } from "../routes/auth.routes";
import { errorHandler } from "../middleware/error.middleware";

const mockAuthService = {
  getNonce: jest.fn(),
  postVerify: jest.fn(),
  getChallenge: jest.fn(),
  postChallengeVerify: jest.fn(),
  getOrCreateNonce: jest.fn(),
  verifyAndIssueToken: jest.fn(),
  createChallenge: jest.fn(),
  verifySignedTransaction: jest.fn(),
};

function buildApp() {
  const app = express();
  app.use(express.json());
  // Mock the rate limiters to avoid interference
  app.use("/api/auth", createAuthRouter(mockAuthService as any));
  app.use(errorHandler);
  return app;
}

describe("Auth Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/auth/challenge", () => {
    it("returns 200 and a challenge when address is provided", async () => {
      mockAuthService.createChallenge.mockResolvedValue({
        transaction: "fake-tx-xdr",
        networkPassphrase: "Test SDF Network ; September 2015",
      });

      const res = await request(buildApp())
        .get("/api/auth/challenge")
        .query({ address: "GUSER123" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        transaction: "fake-tx-xdr",
        networkPassphrase: "Test SDF Network ; September 2015",
      });
      expect(mockAuthService.createChallenge).toHaveBeenCalledWith("GUSER123");
    });

    it("returns 400 when address is missing", async () => {
      const res = await request(buildApp()).get("/api/auth/challenge");
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Missing query parameter: address");
    });

    it("returns 400 when service throws Error", async () => {
      mockAuthService.createChallenge.mockRejectedValue(new Error("Invalid address"));
      const res = await request(buildApp())
        .get("/api/auth/challenge")
        .query({ address: "INVALID" });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Invalid address");
    });
  });

  describe("POST /api/auth/challenge/verify", () => {
    it("returns 200 and a token on valid signature", async () => {
      mockAuthService.verifySignedTransaction.mockResolvedValue("fake-jwt-token");

      const res = await request(buildApp())
        .post("/api/auth/challenge/verify")
        .send({ signed_transaction: "signed-tx-xdr" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        token: "fake-jwt-token",
        tokenType: "Bearer",
        expiresIn: "24h",
      });
      expect(mockAuthService.verifySignedTransaction).toHaveBeenCalledWith("signed-tx-xdr");
    });

    it("returns 400 when signed_transaction is missing", async () => {
      const res = await request(buildApp())
        .post("/api/auth/challenge/verify")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Missing required field: signed_transaction");
    });

    it("returns 401 when service throws 'expired'", async () => {
      mockAuthService.verifySignedTransaction.mockRejectedValue(new Error("Challenge expired"));
      const res = await request(buildApp())
        .post("/api/auth/challenge/verify")
        .send({ signed_transaction: "signed-tx-xdr" });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "Challenge expired");
    });
  });

  describe("GET /api/auth/nonce", () => {
    it("returns 200 and a nonce", async () => {
      mockAuthService.getOrCreateNonce.mockResolvedValue({ nonce: "fake-nonce" });

      const res = await request(buildApp())
        .get("/api/auth/nonce")
        .query({ address: "GUSER123" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ nonce: "fake-nonce" });
      expect(mockAuthService.getOrCreateNonce).toHaveBeenCalledWith("GUSER123");
    });
  });

  describe("POST /api/auth/verify", () => {
    it("returns 200 and a token on valid signature", async () => {
      mockAuthService.verifyAndIssueToken.mockResolvedValue("fake-jwt-token");

      const res = await request(buildApp())
        .post("/api/auth/verify")
        .send({ address: "GUSER123", signature: "fake-sig" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBe("fake-jwt-token");
      expect(mockAuthService.verifyAndIssueToken).toHaveBeenCalledWith("GUSER123", "fake-sig");
    });

    it("returns 400 when fields are missing", async () => {
      const res = await request(buildApp())
        .post("/api/auth/verify")
        .send({ address: "GUSER123" });
      expect(res.status).toBe(400);
    });
  });
});
