import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./api", () => ({
  adminApi: { mutate: vi.fn(), confirmPassword: vi.fn(async () => ({})) },
}));
import { adminApi } from "./api";
import { RefundDialog } from "./RefundDialog";
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
function show(kind: "cash-refund" | "generation-restoration" | "credit-adjustment") {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RefundDialog
        userId="customer"
        source={{ id: "source", amountMinor: 5000 }}
        kind={kind}
        ar={false}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "Local test restoration review" },
  });
  fireEvent.click(screen.getByRole("button", { name: kind === "credit-adjustment" ? "Review adjustment" : "Review refund" }));
}
describe("source-linked refund review", () => {
  it("reviews a customer-prefilled credit change and confirms with a password", async () => {
    vi.mocked(adminApi.mutate).mockResolvedValueOnce({ balance: 100, available: 80, delta: 1, balanceAfter: 101 }).mockResolvedValueOnce({ id: "adjustment", revision: 1 }).mockResolvedValueOnce({ status: "confirmed" });
    show("credit-adjustment");
    await screen.findByText("Balance after adjustment");
    expect(adminApi.mutate).toHaveBeenCalledWith("finance/preview", { kind: "credit-adjustment", userId: "customer", delta: 1, reason: "Local test restoration review" }, expect.any(String));
    fireEvent.change(screen.getByLabelText("Confirm your password"), { target: { value: "synthetic-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm adjustment" }));
    await screen.findByText(/Credit adjustment completed/);
    expect(adminApi.confirmPassword).toHaveBeenCalledTimes(1);
  });
  it("blocks cash approval when the purchase lacks verified gateway identifiers", async () => {
    vi.mocked(adminApi.mutate).mockResolvedValue({ executionEnabled: true, gatewayReady: false });
    show("cash-refund");
    expect(await screen.findByRole("button", { name: "Confirm refund" })).toBeDisabled();
  });
  it("previews the purchase and preserves the cash gateway gate", async () => {
    vi.mocked(adminApi.mutate).mockResolvedValue({
      priorRefundsMinor: 1000,
      remainingRefundableMinor: 4000,
      creditsToRetire: 60,
      balanceAfter: 0,
      executionEnabled: false,
    });
    show("cash-refund");
    expect(
      await screen.findByRole("button", { name: "Confirm refund" }),
    ).toBeDisabled();
    expect(adminApi.mutate).toHaveBeenCalledWith(
      "finance/preview",
      expect.objectContaining({
        userId: "customer",
        orderId: "source",
        amountMinor: 5000,
      }),
      expect.any(String),
    );
    expect(adminApi.confirmPassword).not.toHaveBeenCalled();
  });
  it("confirms the password and reuses the same approval after an uncertain response", async () => {
    vi.mocked(adminApi.mutate)
      .mockResolvedValueOnce({ chargedCredits: 20 })
      .mockResolvedValueOnce({ id: "request", revision: 1 })
      .mockRejectedValueOnce(new Error("Connection interrupted"))
      .mockResolvedValueOnce({ status: "approved" });
    show("generation-restoration");
    await screen.findByLabelText("Confirm your password");
    fireEvent.change(screen.getByLabelText("Confirm your password"), {
      target: { value: "synthetic-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm refund" }));
    await screen.findByText("Connection interrupted");
    fireEvent.change(screen.getByLabelText("Confirm your password"), {
      target: { value: "synthetic-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm refund" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Request approved"),
    );
    const calls = vi.mocked(adminApi.mutate).mock.calls;
    expect(calls.filter(([path]) => path === "finance/requests")).toHaveLength(
      1,
    );
    expect(calls[2][2]).toBe(calls[3][2]);
    expect(adminApi.confirmPassword).toHaveBeenCalledTimes(2);
  });
});
