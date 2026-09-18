import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(() => { throw new Error("legacy database accessed"); }),
  channel: vi.fn(() => { throw new Error("legacy realtime accessed"); }),
}));

vi.mock("@/config/features", () => ({ isFeatureEnabled: (name: string) => name === "portableAuth" }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-one" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en", t: (key: string) => key }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));

import NotificationBell from "./NotificationBell";

describe("NotificationBell in portable mode", () => {
  it("links to the portable notifications screen without touching Supabase", () => {
    render(<MemoryRouter><NotificationBell /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/notifications");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.channel).not.toHaveBeenCalled();
  });
});
