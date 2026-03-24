declare global {
  namespace Express {
    interface Request {
      /** Stellar public key (G...) after JWT verification */
      walletAddress?: string;
    }
  }
}

export {};
