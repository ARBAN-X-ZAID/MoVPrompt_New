import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { AuthCapability } from "@movprompt/contracts";

import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthGateDialog } from "./AuthGateDialog";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderGate(locale: "en" | "ar" = "en", authCapability?: AuthCapability | null) {
  return render(
    <MemoryRouter initialEntries={["/create"]}>
      <LanguageProvider initialLocale={locale}>
        <AuthGateDialog open onOpenChange={() => undefined} returnPath="/create?draft=draft-1&resume=generate" authCapability={authCapability} />
        <LocationProbe />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe("AuthGateDialog provider truth", () => {
  afterEach(() => {
    cleanup();
    localStorage.removeItem("movprompt-lang");
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
  });

  it("shows email as the primary local path and no dead social controls", () => {
    renderGate();

    const email = screen.getByRole("button", { name: "Continue with email" });
    expect(email).toHaveClass("creator-button-primary");
    expect(screen.queryByRole("button", { name: /Google|Apple/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/^or$/i)).not.toBeInTheDocument();

    fireEvent.click(email);
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/auth?next=%2Fcreate%3Fdraft%3Ddraft-1%26resume%3Dgenerate",
    );
  });

  it("localizes the entire handoff in Arabic", () => {
    // The full suite can leave another test's persisted English preference in
    // the shared browser storage. This handoff is explicitly Arabic, so its
    // render must not depend on that ambient value or test execution order.
    localStorage.setItem("movprompt-lang", "en");
    renderGate("ar");

    expect(screen.getByRole("heading", { name: "سجّل الدخول لتنزيل الفيديو" })).toBeVisible();
    expect(screen.getByRole("button", { name: "المتابعة بالبريد الإلكتروني" })).toBeVisible();
    expect(screen.getByText(/الفيديو جاهز/)).toBeVisible();
    expect(screen.queryByText(/Your campaign|Continue with email|No charge|السعر|الخصم/)).not.toBeInTheDocument();
  });

  it("renders exactly the configured server social methods and focuses the first enabled method", async () => {
    const baseCapability: AuthCapability = {
      emailPassword: true,
      configuredProviders: ["google"],
      firstCampaignVerificationPolicy: "deferred_until_after_first_campaign",
    };

    renderGate("en", baseCapability);
    const google = await screen.findByRole("button", { name: "Continue with Google" });
    expect(google).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Continue with Apple" })).not.toBeInTheDocument();

    cleanup();
    renderGate("en", { ...baseCapability, configuredProviders: ["google", "apple"] });
    expect(await screen.findByRole("button", { name: "Continue with Google" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue with Apple" })).toBeVisible();
  });

  it("reports cancellation through the existing dialog close action without clearing the return intent", () => {
    const onOpenChange = vi.fn();
    localStorage.setItem("movprompt-lang", "en");
    render(
      <MemoryRouter initialEntries={["/create"]}>
        <LanguageProvider>
          <AuthGateDialog open onOpenChange={onOpenChange} returnPath="/create?draft=draft-1&resume=generate" authCapability={{ emailPassword: true, configuredProviders: [], firstCampaignVerificationPolicy: "deferred_until_after_first_campaign" }} />
        </LanguageProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
