import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider } from "../hooks/useWallet";
import { ToastProvider } from "../components/ToastProvider";

/**
 * Centralized render helper used across the repo.
 * Wraps UI with routing, react‑query, wallet, and toast contexts.
 * Allows tests to override the wallet via the `wallet` argument.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    wallet = { address: "GADMINADDRESS", isAdmin: true },
    ...options
  }: {
    wallet?: { address: string; isAdmin: boolean };
    queryClient?: QueryClient;
  } & RenderOptions = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <WalletProvider value={wallet}>
          <ToastProvider>{children}</ToastProvider>
        </WalletProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
