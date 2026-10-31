import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { changePassword } = vi.hoisted(() => ({ changePassword: vi.fn() }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("@/components/ThemeProvider", () => ({ useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }) }));
vi.mock("@/components/LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("@/lib/auth/portableAuthClient", () => ({
  authErrorMessage: (error: { message?: string }) => error?.message ?? "Failed",
  portableAuthClient: { changePassword, signOut: vi.fn() },
}));
vi.mock("./api", () => ({
  adminApi: { identity: vi.fn(async () => ({ name: "Owner", email: "owner@example.test" })) },
}));
import AdminSettings from "./AdminSettings";

async function renderSettings() {
  render(<QueryClientProvider client={new QueryClient()}><AdminSettings /></QueryClientProvider>);
  await screen.findByRole("heading", { name: "Security" });
}

function fillPasswords(next = "new-password-1", repeat = next) {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-password-1" } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Repeat new password"), { target: { value: repeat } });
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Change password" }));

describe("owner password settings", () => {
  beforeEach(() => changePassword.mockReset());
  afterEach(cleanup);

  it("opens the shared confirmation dialog from Settings", async () => {
    const requested = vi.fn();
    window.addEventListener("movprompt:admin-confirmation-required", requested);
    await renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Confirm password" }));
    expect(requested).toHaveBeenCalledOnce();
    window.removeEventListener("movprompt:admin-confirmation-required", requested);
  });

  it("does not send mismatched passwords", async () => {
    await renderSettings();
    fillPasswords("new-password-1", "new-password-2");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("changes the password, signs out other devices and clears the form", async () => {
    changePassword.mockResolvedValue({ data: { user: {} }, error: null });
    await renderSettings();
    fillPasswords();
    submit();
    expect(await screen.findByRole("status")).toHaveTextContent("Password changed");
    expect(changePassword).toHaveBeenCalledWith({ currentPassword: "old-password-1", newPassword: "new-password-1", revokeOtherSessions: true });
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });

  it("asks for confirmation and keeps the typed values when the server requires it", async () => {
    const requested = vi.fn();
    window.addEventListener("movprompt:admin-confirmation-required", requested);
    changePassword.mockResolvedValue({ data: null, error: { code: "OWNER_STEP_UP_REQUIRED", message: "Confirm" } });
    await renderSettings();
    fillPasswords();
    submit();
    await waitFor(() => expect(requested).toHaveBeenCalledOnce());
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirm your password");
    expect(screen.getByLabelText("New password")).toHaveValue("new-password-1");
    window.removeEventListener("movprompt:admin-confirmation-required", requested);
  });

  it("explains a wrong current password", async () => {
    changePassword.mockResolvedValue({ data: null, error: { code: "INVALID_PASSWORD", message: "Invalid password" } });
    await renderSettings();
    fillPasswords();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("current password is not correct");
  });
});
