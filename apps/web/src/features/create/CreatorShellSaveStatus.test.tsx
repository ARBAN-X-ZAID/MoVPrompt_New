import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() }),
}));

vi.mock("@/components/credits/CreditBadge", () => ({
  CreditBadge: () => null,
}));

import { CreatorShell } from "./CreatorShell";
import { DRAFT_SAVE_EVENT, type DraftSaveEventDetail } from "./guestDraftStore";

function emitSaveState(state: DraftSaveEventDetail["state"]) {
  window.dispatchEvent(new CustomEvent<DraftSaveEventDetail>(DRAFT_SAVE_EVENT, {
    detail: { draftId: "draft-1", state },
  }));
}

describe("CreatorShell advanced save status", () => {
  it("does not claim a blank advanced draft is saved", () => {
    render(
      <MemoryRouter initialEntries={["/advanced"]}>
        <CreatorShell studio={{ title: "Untitled direction", templatePath: "/create" }}>
          <div>Studio</div>
        </CreatorShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Not saved yet");
  });

  it("reports saving, saved and failed persistence events", () => {
    render(
      <MemoryRouter initialEntries={["/advanced?draft=draft-1"]}>
        <CreatorShell studio={{ title: "Product direction", templatePath: "/create?draft=draft-1" }}>
          <div>Studio</div>
        </CreatorShell>
      </MemoryRouter>,
    );

    act(() => emitSaveState("saving"));
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");

    act(() => emitSaveState("saved"));
    expect(screen.getByRole("status")).toHaveTextContent("Changes saved");

    act(() => emitSaveState("error"));
    expect(screen.getByRole("status")).toHaveTextContent("Save failed — keep this tab open");
  });
});
