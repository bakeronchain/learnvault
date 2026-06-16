import { vi } from 'vitest';

export const useAdminContracts = vi.fn(() => ({
  // Add any contract data the Admin page may read; keep minimal
  contracts: [],
  loading: false,
  error: null,
}));
