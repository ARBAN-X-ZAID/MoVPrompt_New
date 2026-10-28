import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: "en" }),
}));
vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));
vi.mock("@/components/LanguageToggle", () => ({
  LanguageToggle: () => <button>عربي</button>,
}));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("@/lib/auth/portableAuthClient", () => ({
  portableAuthClient: {
    signIn: { email: vi.fn() },
    twoFactor: { verifyTotp: vi.fn(), verifyBackupCode: vi.fn() },
  },
  authErrorMessage: (error: Error) => error.message,
}));
import { portableAuthClient } from "@/lib/auth/portableAuthClient";
import { PortableApiError } from "@/lib/api/portableApiClient";
import { OwnerAccess } from "./OwnerAccess";
import { OwnerAccessLoading } from "./OwnerAccessFrame";
const reload = vi.fn();
function show(error?: Error) {
  render(
    <MemoryRouter>
      <OwnerAccess reload={reload} error={error} />
    </MemoryRouter>,
  );
}
function enterCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "owner@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "synthetic-only-password" },
  });
}
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
describe("owner access presentation and authentication", () => {
  it("toggles password visibility without submitting or losing its value", () => {
    show();
    enterCredentials();
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Password")).toHaveValue(
      "synthetic-only-password",
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(portableAuthClient.signIn.email).not.toHaveBeenCalled();
  });
  it("shows pending state and preserves recovery after rejected credentials", async () => {
    let complete: (value: unknown) => void;
    vi.mocked(portableAuthClient.signIn.email).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }) as never,
    );
    show();
    enterCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
    complete!({ error: { message: "Invalid email or password" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password",
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(reload).not.toHaveBeenCalled();
  });
  it("keeps MFA and recovery-code verification after password sign-in", async () => {
    vi.mocked(portableAuthClient.signIn.email).mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    } as never);
    vi.mocked(portableAuthClient.twoFactor.verifyBackupCode).mockResolvedValue({
      data: {},
      error: null,
    } as never);
    show();
    enterCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Verify your sign-in" });
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Authenticator code")).toHaveAttribute(
      "autoComplete",
      "one-time-code",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use a recovery code" }),
    );
    fireEvent.change(screen.getByLabelText("Recovery code"), {
      target: { value: "synthetic-backup" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(portableAuthClient.twoFactor.verifyBackupCode).toHaveBeenCalledWith({
      code: "synthetic-backup",
      trustDevice: false,
    });
    expect(portableAuthClient.twoFactor.verifyTotp).not.toHaveBeenCalled();
  });
  it("keeps owner denial visible with actionable copy", () => {
    show(
      new PortableApiError(
        "Owner access is required.",
        "owner_required",
        false,
        undefined,
        403,
      ),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This account does not have owner access. Sign in with your owner account.",
    );
    expect(screen.getByLabelText("Email")).toBeVisible();
  });
  it("uses the shared access frame and a named loading status before identity resolves", () => {
    const { container } = render(
      <MemoryRouter>
        <OwnerAccessLoading />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Opening your workspace…",
    );
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(
      container.querySelector(".owner-access-panel .owner-access-skeleton"),
    ).not.toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
