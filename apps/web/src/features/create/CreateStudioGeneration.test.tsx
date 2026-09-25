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
  it("does not request an estimate for a restored incompatible purpose; explicit repair preserves the booking link", async () => {
    mocks.quote.mockResolvedValue({ ...GOLDEN_PRODUCT_PATH.quote, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    show({ templateId: "app-service", status: "ready", goal: "bookings", bookingUrl: "https://example.com/book", source: editFact(GOLDEN_PRODUCT_PATH.source, "booking_url", "https://example.com/book"), renderRunId: null, jobId: null });
    await act(async () => {});
    expect(mocks.quote).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continue to review" })).toBeDisabled();
    expect(screen.queryByRole("option", { name: "Get bookings" })).toBeNull();
    await act(async () => { fireEvent.change(screen.getByLabelText("Campaign purpose"), { target: { value: "demonstration" } }); });
    expect(mocks.quote).toHaveBeenCalledOnce();
    expect(mocks.quote.mock.calls[0][0].configuration.templateQuoteContext.goal).toBe("demonstration");
    expect(mocks.quote.mock.calls[0][0].configuration.creativeBrief.product.bookingUrl).toBe("https://example.com/book");
  });
  it("asks for a missing booking link instead of reporting a service outage, then checks the completed configuration", async () => {
    mocks.quote.mockResolvedValue({ ...GOLDEN_PRODUCT_PATH.quote, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    show({ templateId: "salon-booking-offer", status: "ready", goal: "bookings", bookingUrl: "", renderRunId: null, jobId: null });
    await act(async () => {});
    expect(screen.getByText("Add a valid booking link to continue.")).toBeVisible();
    expect(mocks.quote).not.toHaveBeenCalled();
    await act(async () => { fireEvent.change(screen.getByLabelText("Booking link"), { target: { value: "https://example.com/book" } }); });
    expect(mocks.quote).toHaveBeenCalledOnce();
    expect(mocks.quote.mock.calls[0][0].configuration.creativeBrief.product.bookingUrl).toBe("https://example.com/book");
    expect(screen.queryByText("Video generation is temporarily unavailable.")).toBeNull();
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
  it("numbers source, facts, then template when no template was chosen first", async () => {
    mocks.quote.mockResolvedValue({ ...GOLDEN_PRODUCT_PATH.quote, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    show({ status: "ready", renderRunId: null, jobId: null });
    await act(async () => {});
    expect(screen.getByRole("progressbar", { name: "Step" }).textContent).toMatch(/Source.*Facts.*Template.*Campaign/);
  });
});
