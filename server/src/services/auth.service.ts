import { Keypair, StrKey } from "@stellar/stellar-sdk";
import crypto from "node:crypto";

import type { NonceStore } from "../db/nonce-store";
import type { JwtService } from "./jwt.service";

const NONCE_MESSAGE_PREFIX = "LearnVault sign-in: ";

export function isValidStellarPublicKey(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

function randomNoncePayload(): string {
  const bytes = crypto.randomBytes(24);
  return `${NONCE_MESSAGE_PREFIX}${bytes.toString("hex")}`;
}

export type AuthService = {
  getOrCreateNonce(address: string): Promise<{ nonce: string }>;
  verifyAndIssueToken(address: string, signatureBase64: string): Promise<string>;
};

export function createAuthService(
  nonceStore: NonceStore,
  jwtService: JwtService
): AuthService {
  return {
    async getOrCreateNonce(address: string): Promise<{ nonce: string }> {
      if (!isValidStellarPublicKey(address)) {
        throw new Error("Invalid Stellar public key");
      }

      const fresh = randomNoncePayload();
      const nonce = await nonceStore.getOrSetNonce(address, fresh, 300);
      return { nonce };
    },

    async verifyAndIssueToken(
      address: string,
      signatureBase64: string
    ): Promise<string> {
      if (!isValidStellarPublicKey(address)) {
        throw new Error("Invalid Stellar public key");
      }

      const stored = await nonceStore.getNonce(address);
      if (stored === null) {
        throw new Error("Nonce expired or missing; request a new nonce");
      }

      const keypair = Keypair.fromPublicKey(address);
      const messageBytes = Buffer.from(stored, "utf8");
      let signatureBytes: Buffer;
      try {
        signatureBytes = Buffer.from(signatureBase64, "base64");
      } catch {
        throw new Error("Invalid signature encoding");
      }

      if (!keypair.verify(messageBytes, signatureBytes)) {
        throw new Error("Invalid signature");
      }

      await nonceStore.deleteNonce(address);
      return jwtService.signWalletToken(address);
    }
  };
}
