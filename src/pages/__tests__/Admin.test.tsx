/* src/pages/__tests__/Admin.test.tsx */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test-utils";
import { screen, waitFor, within, userEvent } from "@testing-library/react";
import Admin from "../Admin";

// Mock the hooks used inside Admin.
vi.mock("../../hooks/useAdminMilestones");
vi.mock("../../hooks/useWallet");
vi.mock("../../hooks/useAdmin");
vi.mock("../../hooks/useAdminContracts");

import { useAdminMilestones } from "../../hooks/useAdminMilestones";
import { useWallet } from "../../hooks/useWallet";
import { useAdminStats } from "../../hooks/useAdmin";

const mockMilestones = [
  {
    id: "m1",
    learnerAddress: "GLEARNER1",
    course: "Intro to Rust",
    submittedAt: "2024-01-01T00:00:00Z",
    evidenceLink: "",
    status: "pending",
  },
  {
    id: "m2",
    learnerAddress: "GLEARNER2",
    course: "Advanced Solidity",
    submittedAt: "2024-02-01T00:00:00Z",
    evidenceLink: "",
    status: "pending",
  },
] as const;

function mockMilestoneHook(overrides = {}) {
  (useAdminMilestones as any).mockReturnValue({
    milestones: mockMilestones,
    total: mockMilestones.length,
    page: 1,
    pageSize: 20,
    loading: false,
    error: null,
    fetchMilestones: vi.fn(),
    approveMilestone: vi.fn(),
    rejectMilestone: vi.fn(),
    batchApproveMilestones: vi.fn(),
    batchRejectMilestones: vi.fn(),
    ...overrides,
  });
}

describe("Admin Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useWallet as any).mockReturnValue({ address: "GADMINADDRESS", isAdmin: true });
    (useAdminStats as any).mockReturnValue({
      stats: null,
      loading: false,
      error: null,
      fetchStats: vi.fn(),
    });
  });

  // 1️⃣ Pending milestone list renders
  it("renders pending milestones for admins", async () => {
    mockMilestoneHook();
    renderWithProviders(<Admin />);
    const rows = await screen.findAllByRole("row", { name: /pending/i });
    expect(rows).toHaveLength(mockMilestones.length);
    const firstRow = rows[0];
    expect(within(firstRow).getByText("GLEARNER1")).toBeVisible();
    expect(within(firstRow).getByText("Intro to Rust")).toBeVisible();
    expect(within(firstRow).getByRole("button", { name: /approve/i })).toBeVisible();
    expect(within(firstRow).getByRole("button", { name: /reject/i })).toBeVisible();
  });

  // 2️⃣ Approve button calls API
  it("calls approveMilestone when Approve button is clicked", async () => {
    const approveSpy = vi.fn().mockResolvedValue(undefined);
    mockMilestoneHook({ approveMilestone: approveSpy });
    renderWithProviders(<Admin />);
    const row = await screen.findByRole("row", { name: /glearner1/i });
    const approveBtn = within(row).getByRole("button", { name: /approve/i });
    await userEvent.click(approveBtn);
    await waitFor(() => expect(approveSpy).toHaveBeenCalledOnce());
    expect(approveSpy).toHaveBeenCalledWith("m1");
  });

  // 3️⃣ Reject opens reason input
  it("opens reason textarea when Reject button is clicked", async () => {
    const rejectSpy = vi.fn().mockResolvedValue(undefined);
    mockMilestoneHook({ rejectMilestone: rejectSpy });
    renderWithProviders(<Admin />);
    const row = await screen.findByRole("row", { name: /glearner1/i });
    const rejectBtn = within(row).getByRole("button", { name: /reject/i });
    await userEvent.click(rejectBtn);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("textbox", { name: /reason/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeVisible();
  });

  // 4️⃣ Rejection requires reason
  it("prevents rejection without a reason and validates", async () => {
    const rejectSpy = vi.fn().mockResolvedValue(undefined);
    mockMilestoneHook({ rejectMilestone: rejectSpy });
    renderWithProviders(<Admin />);
    const row = await screen.findByRole("row", { name: /glearner1/i });
    const rejectBtn = within(row).getByRole("button", { name: /reject/i });
    await userEvent.click(rejectBtn);
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    await userEvent.click(confirmBtn);
    expect(screen.getByText(/reason is required/i)).toBeVisible();
    expect(rejectSpy).not.toHaveBeenCalled();
    const textarea = screen.getByRole("textbox", { name: /reason/i });
    await userEvent.type(textarea, "Insufficient evidence");
    await userEvent.click(confirmBtn);
    await waitFor(() => expect(rejectSpy).toHaveBeenCalledOnce());
    expect(rejectSpy).toHaveBeenCalledWith("m1", "Insufficient evidence");
  });

  // 5️⃣ Non‑admin access denied
  it("shows access denied for non‑admin wallets", async () => {
    (useWallet as any).mockReturnValue({ address: "GNONADMIN", isAdmin: false });
    renderWithProviders(<Admin />);
    expect(await screen.findByText(/access denied/i)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  // 6️⃣ Success toasts after actions
  it("displays success toast after approval", async () => {
    const approveSpy = vi.fn().mockResolvedValue(undefined);
    mockMilestoneHook({ approveMilestone: approveSpy });
    renderWithProviders(<Admin />);
    const row = await screen.findByRole("row", { name: /glearner1/i });
    const approveBtn = within(row).getByRole("button", { name: /approve/i });
    await userEvent.click(approveBtn);
    await waitFor(() => expect(approveSpy).toHaveBeenCalled());
    expect(await screen.findByText(/milestone approved/i)).toBeVisible();
  });

  it("displays success toast after rejection", async () => {
    const rejectSpy = vi.fn().mockResolvedValue(undefined);
    mockMilestoneHook({ rejectMilestone: rejectSpy });
    renderWithProviders(<Admin />);
    const row = await screen.findByRole("row", { name: /glearner1/i });
    const rejectBtn = within(row).getByRole("button", { name: /reject/i });
    await userEvent.click(rejectBtn);
    const textarea = screen.getByRole("textbox", { name: /reason/i });
    await userEvent.type(textarea, "Bad evidence");
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    await userEvent.click(confirmBtn);
    await waitFor(() => expect(rejectSpy).toHaveBeenCalled());
    expect(await screen.findByText(/milestone rejected/i)).toBeVisible();
  });

  // 7️⃣ Milestone removed after approval
  it("removes milestone from list after successful approval", async () => {
    const approveSpy = vi.fn().mockResolvedValue(undefined);
    // First render returns a milestone, second render returns an empty list (simulating refetch)
    (useAdminMilestones as any)
      .mockImplementationOnce(() => ({
        milestones: mockMilestones,
        total: mockMilestones.length,
        loading: false,
        error: null,
        fetchMilestones: vi.fn(),
        approveMilestone: approveSpy,
        rejectMilestone: vi.fn(),
        batchApproveMilestones: vi.fn(),
        batchRejectMilestones: vi.fn(),
      }))
      .mockImplementationOnce(() => ({
        milestones: [],
        total: 0,
        loading: false,
        error: null,
        fetchMilestones: vi.fn(),
        approveMilestone: vi.fn(),
        rejectMilestone: vi.fn(),
        batchApproveMilestones: vi.fn(),
        batchRejectMilestones: vi.fn(),
      }));
    renderWithProviders(<Admin />);
    const row = await screen.findByRole("row", { name: /glearner1/i });
    const approveBtn = within(row).getByRole("button", { name: /approve/i });
    await userEvent.click(approveBtn);
    await waitFor(() => expect(approveSpy).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.queryByRole("row", { name: /glearner1/i })).not.toBeInTheDocument();
    });
  });
});
