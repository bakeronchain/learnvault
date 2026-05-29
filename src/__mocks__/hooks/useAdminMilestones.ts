import { vi } from "vitest";

export const useAdminMilestones = vi.fn(() => ({
  milestones: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  error: null,
  fetchMilestones: vi.fn(),
  approveMilestone: vi.fn(),
  rejectMilestone: vi.fn(),
  batchApproveMilestones: vi.fn(),
  batchRejectMilestones: vi.fn(),
}));
