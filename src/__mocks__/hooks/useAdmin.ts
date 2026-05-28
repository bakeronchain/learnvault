import { vi } from 'vitest';

export const useAdminStats = vi.fn(() => ({
  stats: null,
  loading: false,
  error: null,
  fetchStats: vi.fn(),
}));
