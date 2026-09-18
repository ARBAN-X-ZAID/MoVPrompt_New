import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { LanguageProvider } from "@/i18n/LanguageContext";
import logoMark from "@/assets/logo-mark-white.svg";
import Auth from "./Auth";

const authMocks = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  requestPasswordReset: vi.fn(),
  signInSocial: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/config/features", () => ({
  isFeatureEnabled: (feature: string) => feature === "portableAuth",
}));

vi.mock("@/config/authPolicy", () => ({
  isEmailVerificationRequired: () => false,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: authMocks.toast }),
}));

vi.mock("@/lib/auth/portableAuthActions", () => ({
  portableAuthActions: {
    signInEmail: authMocks.signInEmail,
    signUpEmail: authMocks.signUpEmail,
    requestPasswordReset: authMocks.requestPasswordReset,
    signInSocial: authMocks.signInSocial,
  },
}));

vi.mock("@/lib/api/portableApiClient", () => ({
  portableCreatorApi: {
    featureFlags: vi.fn(() => new Promise(() => undefined)),
  },
}));

vi.mock("@/components/InstallPrompt", () => ({ InstallPrompt: () => null }));
vi.mock("@/components/LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));

function renderAuth() {
  return render(
    <MemoryRouter initialEntries={["/auth?next=/create"]}>
      <LanguageProvider initialLocale="en">
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/create" element={<output data-testid="destination">/create</output>} />
        </Routes>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

function openSignUp() {
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Sign Up" }), { button: 0, ctrlKey: false });
  return screen.getByRole("button", { name: "Create account" });
}

function fillSignUpForm() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Local QA Creator" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "qa@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "local-test-password" } });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("authentication screen flow", () => {
  beforeEach(() => {
    authMocks.signInEmail.mockReset();
    authMocks.signUpEmail.mockReset();
    authMocks.requestPasswordReset.mockReset();
    authMocks.signInSocial.mockReset();
    authMocks.toast.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
  });

  it("uses the shared MovPrompt brand on sign-in and sign-up", () => {
    renderAuth();

    const brand = screen.getByRole("link", { name: "MovPrompt home" });
    expect(brand).toHaveTextContent("MovPrompt");
    expect(brand.querySelector("img")).toHaveAttribute("src", logoMark);

    openSignUp();
    expect(screen.getByRole("link", { name: "MovPrompt home" })).toBe(brand);
  });

  it("keeps account creation disabled until the terms are accepted", () => {
    renderAuth();
    const submit = openSignUp();

    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
  });

  it("creates an account through Better Auth and returns to the requested creator route", async () => {
    authMocks.signUpEmail.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    renderAuth();
    const submit = openSignUp();
    fillSignUpForm();

    fireEvent.click(submit);

    await waitFor(() => expect(authMocks.signUpEmail).toHaveBeenCalledWith(expect.objectContaining({
      email: "qa@example.test",
      name: "Local QA Creator",
      password: "local-test-password",
    })));
    expect(await screen.findByTestId("destination")).toHaveTextContent("/create");
    expect(localStorage.getItem("first_signup_pending")).toBe("1");
  });

  it("shows a sign-up error and releases the loading state for another attempt", async () => {
    authMocks.signUpEmail.mockResolvedValueOnce({ error: { message: "Account already exists" } });
    renderAuth();
    const submit = openSignUp();
    fillSignUpForm();

    fireEvent.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent("Account already exists");
    await waitFor(() => {
      expect(submit).toBeEnabled();
      expect(screen.queryByText(/Checking the connection/)).not.toBeInTheDocument();
    });
  });

  it("shows a sign-in error and releases the loading state for another attempt", async () => {
    authMocks.signInEmail.mockResolvedValueOnce({ error: { message: "Invalid email or password" } });
    renderAuth();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "qa@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    const submit = screen.getByRole("button", { name: "Sign in" });

    fireEvent.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(submit).toBeEnabled();
  });
});
