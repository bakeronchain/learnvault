import { vi } from 'vitest';

export const useWallet = vi.fn(() => ({
  address: 'GADMINADDRESS',
  isAdmin: true,
}));
