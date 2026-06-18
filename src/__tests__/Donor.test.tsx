import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DepositMore } from "../components/donor/DepositMore";
import { MyContributions } from "../components/donor/MyContributions";

// Mocking toast hook
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockShowInfo = vi.fn();

vi.mock("../components/Toast/ToastProvider", () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showInfo: mockShowInfo,
  }),
}));

// Mocking contract IDs hook
vi.mock("../hooks/useContractIds", () => ({
  useContractIds: () => ({
    scholarshipTreasury: "CC32NKWO6V5UCDV674HBE32N4C3EAWBVO5M4U6Y74E2ST7B3TREASURY",
  }),
}));

// Mocking i18n
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "en" },
  }),
}));

// Mocking stellar helper calls
const mockDepositMethod = vi.fn().mockResolvedValue("tx_hash_12345");
vi.mock("../util/scholarshipTreasury", () => ({
  SCHOLARSHIP_TREASURY_CONTRACT_ID: "CC_DEFAULT_TREASURY_ID",
  createScholarshipTreasuryContract: () => ({
    deposit: mockDepositMethod,
  }),
}));

// Mocking useWallet hook variables
let mockAddress: string | null = "GDQP2CNOEF32NKWO6V5UCDV674HBE32N4C3EAWBVO5M4U6Y74E2ST7B3";
const mockSignTransaction = vi.fn().mockResolvedValue("signed_tx");
const mockUpdateBalances = vi.fn().mockResolvedValue(true);

vi.mock("../hooks/useWallet", () => ({
  useWallet: () => ({
    address: mockAddress,
    signTransaction: mockSignTransaction,
    updateBalances: mockUpdateBalances,
  }),
}));

describe("Donor Page / Deposit Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddress = "GDQP2CNOEF32NKWO6V5UCDV674HBE32N4C3EAWBVO5M4U6Y74E2ST7B3";
  });

  // 1. Verify "Connect Wallet" CTA appears when wallet state is disconnected
  it("renders Connect Wallet CTA when disconnected", () => {
    mockAddress = null; // simulate disconnected state
    render(<DepositMore />);
    
    const submitBtn = screen.getByRole("button", { name: /Connect Wallet to Deposit/i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();
  });

  // 2. Verify USDC deposit form renders with validation (positive amount only)
  it("enforces validation allowing positive amount only", async () => {
    render(<DepositMore />);

    const input = screen.getByPlaceholderText("0.00");
    const submitBtn = screen.getByRole("button", { name: /Deposit/i });

    // Try sending with empty value
    fireEvent.click(submitBtn);
    expect(mockShowError).toHaveBeenCalledWith("Please enter a valid amount");

    // Try sending zero amount
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(submitBtn);
    expect(mockShowError).toHaveBeenCalledWith("Please enter a valid amount");

    // Try sending negative value (filtered by regex in input change, but verify fallback)
    fireEvent.change(input, { target: { value: "-50" } });
    fireEvent.click(submitBtn);
    expect(mockShowError).toHaveBeenCalledWith("Please enter a valid amount");
  });

  // 3. Mock Soroban contract client and assert correct deposit method call
  // 4. Test success UI state and simulated GOV balance update
  it("submits deposit, updates balance on success, and displays success banner", async () => {
    const handleSuccessMock = vi.fn();
    render(<DepositMore onDepositSuccess={handleSuccessMock} />);

    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "100.00" } });

    // Exchange details check
    expect(screen.getByText("100 GOV")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Deposit \$100/i });
    fireEvent.click(submitBtn);

    expect(mockShowInfo).toHaveBeenCalledWith("Waiting for wallet approval...");

    await waitFor(() => {
      // Asserting correct deposit method call structure on contract client
      expect(mockDepositMethod).toHaveBeenCalledWith("100.00", mockSignTransaction);
      expect(mockUpdateBalances).toHaveBeenCalled();
      expect(mockShowSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Deposit of 100.00 USDC submitted")
      );
      expect(handleSuccessMock).toHaveBeenCalled();
    });

    // Check success status banner shows up on page
    expect(await screen.findByText("Deposit Submitted")).toBeInTheDocument();
    expect(screen.getByText("Transaction: tx_hash_12345")).toBeInTheDocument();
  });

  // 5. Assert contribution history fetches and renders
  it("fetches and renders contribution history", () => {
    const contributionsMock = [
      {
        txHash: "hash_abcdef1234567890",
        amount: 250,
        date: "2026-05-26T12:00:00.000Z",
        block: 452901,
      },
      {
        txHash: "hash_0987654321fedcba",
        amount: 1200,
        date: "2026-05-25T10:30:00.000Z",
        block: 452100,
      },
    ];

    render(
      <MyContributions
        contributions={contributionsMock}
        totalContributed={1450}
      />
    );

    // Total Deposited check
    expect(screen.getByText("$1,450")).toBeInTheDocument();

    // Contributions lists rendering check
    expect(screen.getByText("$250")).toBeInTheDocument();
    expect(screen.getByText("$1,200")).toBeInTheDocument();

    expect(screen.getByText("hash_abcdef1234567890")).toBeInTheDocument();
    expect(screen.getByText("hash_0987654321fedcba")).toBeInTheDocument();

    expect(screen.getByText("Block 452901")).toBeInTheDocument();
    expect(screen.getByText("Block 452100")).toBeInTheDocument();
  });
});
