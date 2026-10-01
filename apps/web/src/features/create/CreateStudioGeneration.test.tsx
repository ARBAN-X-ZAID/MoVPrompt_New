import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoldenPathProject, GOLDEN_PRODUCT_PATH } from "./__fixtures__/goldenPathFixtures";
import type { CreatorProject } from "./types";

const mocks = vi.hoisted(() => ({ poll: vi.fn(), quote: vi.fn(), getTemplate: vi.fn(), cancel: vi.fn(), project: null as unknown, user: { id: "11111111-1111-4111-8111-111111111111" } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: false, signOut: vi.fn() }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en", t: (key: string) => key }) }));
vi.mock("@/features/create/CreatorShell", () => ({ CreatorShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("./AuthGateDialog", () => ({ AuthGateDialog: () => null }));
vi.mock("@/config/features", () => ({ isFeatureEnabled: (name: string) => name !== "localDemoGeneration" }));
vi.mock("@/lib/api/portableApiClient", async original => ({ ...await original<object>(), portableCreatorApi: { claimGuestResults: vi.fn().mockResolvedValue({}), generationQuote: mocks.quote, getTemplate: mocks.getTemplate, guestSession: vi.fn() } }));
vi.mock("@/lib/director/api", () => ({ pollCreatorGeneration: mocks.poll, pollVideoJob: mocks.poll, startCreatorGeneration: vi.fn(), cancelCreatorGeneration: mocks.cancel, cancelVideoJob: mocks.cancel }));
vi.mock("./projectStore", async original => ({ ...await original<object>(), resolvePortableTemplateVersionId: vi.fn(async () => "44444444-4444-4444-8444-444444444444"), getLocalCreatorProject: () => mocks.project, loadCreatorProjects: vi.fn(async () => [mocks.project]), syncCreatorProject: vi.fn(async (project: unknown) => project), saveLocalCreatorProject: vi.fn() }));

import { CreateStudio } from "./CreateStudio";
import { getCreatorTemplate } from "./templates";
import { editFact } from "./sourceFacts";

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });
function show(changes: Partial<CreatorProject> = {}) {
  mocks.getTemplate.mockImplementation(async (id: string) => {
    const template = getCreatorTemplate(id);
    return { goals: template.goals, supportedLanguages: template.languages, supportedRatios: template.aspectRatios };
  });
  mocks.project = { ...createGoldenPathProject(GOLDEN_PRODUCT_PATH), id: "22222222-2222-4222-8222-222222222222", jobId: "33333333-3333-4333-8333-333333333333", renderRunId: "33333333-3333-4333-8333-333333333333", status: "generating", ...changes };
  // Real status branch; simulation is explicitly disabled for this test.
  render(<MemoryRouter initialEntries={["/create?project=22222222-2222-4222-8222-222222222222"]}><CreateStudio /></MemoryRouter>);
}
const job = { id: "33333333-3333-4333-8333-333333333333", status: "processing", processing_stage: "rendering", created_at: "2026-09-15T12:00:00.000Z" };
describe("saved generation status", () => {
  it("repairs a restored purpose the template cannot use and keeps the booking link", async () => {
    mocks.quote.mockResolvedValue({ ...GOLDEN_PRODUCT_PATH.quote, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    show({ templateId: "app-service", status: "ready", goal: "bookings", bookingUrl: "https://example.com/book", source: editFact(GOLDEN_PRODUCT_PATH.source, "booking_url", "https://example.com/book"), renderRunId: null, jobId: null });
    await act(async () => {});
    expect(screen.queryByLabelText("Campaign purpose")).toBeNull();
    expect(mocks.quote).toHaveBeenCalledOnce();
    expect(mocks.quote.mock.calls[0][0].configuration.templateQuoteContext.goal).toBe("demonstration");
    expect(mocks.quote.mock.calls[0][0].configuration.creativeBrief.product.bookingUrl).toBe("https://example.com/book");
  });
  it("quotes a booking campaign without a booking link and carries the optional message into the brief", async () => {
    mocks.quote.mockResolvedValue({ ...GOLDEN_PRODUCT_PATH.quote, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    show({ templateId: "salon-booking-offer", status: "ready", goal: "bookings", bookingUrl: "", renderRunId: null, jobId: null });
    await act(async () => {});
    expect(screen.queryByText("Add a valid booking link to continue.")).toBeNull();
    expect(screen.queryByLabelText("Booking link")).toBeNull();
    expect(mocks.quote).toHaveBeenCalled();
    await act(async () => { fireEvent.change(screen.getByLabelText("Anything to say in the video?"), { target: { value: "20% off this week" } }); });
    await act(async () => { fireEvent.change(screen.getByLabelText("What is it called?"), { target: { value: "Noura Salon" } }); });
    await act(async () => { fireEvent.change(screen.getByLabelText("What should the viewer do?"), { target: { value: "Book a visit" } }); });
    const latest = mocks.quote.mock.calls.at(-1)![0];
    expect(latest.configuration.creativeBrief.product.offer).toBe("20% off this week");
    expect(latest.configuration.creativeBrief.product.name).toBe("Noura Salon");
    expect(latest.configuration.creativeBrief.product.callToAction).toBe("Book a visit");
    expect(screen.queryByText("Video generation is temporarily unavailable.")).toBeNull();
  });

  it("offers 8, 15 and 20 second lengths and re-prices the chosen one", async () => {
    mocks.quote.mockResolvedValue({ ...GOLDEN_PRODUCT_PATH.quote, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    show({ status: "ready", renderRunId: null, jobId: null });
    await act(async () => {});
    for (const seconds of [8, 15, 20]) {
      expect(screen.getByRole("radio", { name: `${seconds} seconds` })).toBeVisible();
    }
    expect(screen.queryByRole("radio", { name: "12 seconds" })).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("radio", { name: "20 seconds" })); });
    const latest = mocks.quote.mock.calls.at(-1)![0];
    expect(latest.configuration.durationSeconds).toBe(20);
    expect(latest.configuration.creativeBrief.scenes.reduce((sum: number, scene: { duration: number }) => sum + scene.duration, 0)).toBe(20);
    expect(latest.configuration.creativeBrief.scenes[0].direction).toContain("Hold the first photo, then orbit slowly.");
  });
  it("keeps the saved generation visible when cancellation fails", async () => {
    mocks.poll.mockResolvedValue(job);
    mocks.cancel.mockRejectedValueOnce(new Error("Unable to cancel this video. Please try again."));
    show(); await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel generation" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to cancel this video");
    expect(screen.getByRole("progressbar")).toBeVisible();
  });
  it("does not overlap slow status requests and restores elapsed time from the run", async () => {
    vi.useFakeTimers(); vi.setSystemTime(Date.parse("2026-09-15T12:02:00Z"));
    let finish!: (value: typeof job) => void;
    mocks.poll.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    show(); await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
    expect(mocks.poll).toHaveBeenCalledTimes(1);
    await act(async () => { finish(job); });
    expect(screen.getByText("02:12")).toBeVisible();
  });
  it("shows a connection error and clears it after a successful retry", async () => {
    mocks.poll.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(job);
    show(); await act(async () => {});
    expect(screen.getByRole("alert")).toHaveTextContent("couldn’t check video status");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry status check" })); });
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("stops polling after failure and displays the provider error with recovery", async () => {
    vi.useFakeTimers();
    mocks.poll.mockResolvedValue({ ...job, status: "failed", processing_stage: "failed", error: "Generation provider could not complete this video." });
    show(); await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(mocks.poll).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Generation provider could not complete");
    expect(screen.getByRole("button", { name: "Back to campaign" })).toBeVisible();
    expect(screen.queryByText(/creation will continue in the background/)).toBeNull();
  });
  it("shows one create screen with no step bar", async () => {
    mocks.quote.mockResolvedValue({ ...GOLDEN_PRODUCT_PATH.quote, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    show({ status: "ready", renderRunId: null, jobId: null });
    await act(async () => {});
    expect(screen.queryByRole("progressbar", { name: "Step" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Make your video" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Generate video/ })).toBeVisible();
  });
  it("keeps a reopened provider failure below Generate instead of losing it or putting it beside link import", async () => {
    mocks.poll.mockResolvedValue({ ...job, status: "failed", processing_stage: "failed", error_code: "provider_person_reference_rejected", error: "Safe server error" });
    show({ status: "failed", lastError: null });
    await act(async () => {});
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("even if the person was AI-generated");
    expect(screen.getByRole("button", { name: /Generate video/ }).nextElementSibling).toBe(alert);
    expect(alert.closest(".creator-create-stage")).toBeNull();
  });
});
