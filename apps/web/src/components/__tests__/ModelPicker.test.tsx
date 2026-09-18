import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ModelPicker } from "@/components/ModelPicker";
import { LanguageProvider } from "@/i18n/LanguageContext";

const renderWithProviders = (ui: React.ReactElement) =>
  render(<LanguageProvider>{ui}</LanguageProvider>);

describe("ModelPicker", () => {
  it("renders the trigger with a selected value", () => {
    const { getByRole } = renderWithProviders(
      <ModelPicker model="any" onModelChange={() => {}} />,
    );
    const trigger = getByRole("combobox");
    expect(trigger).toBeInTheDocument();
  });

  it("reflects model prop changes in the trigger label without crashing", () => {
    const onChange = vi.fn();
    const { getByRole, rerender } = renderWithProviders(
      <ModelPicker model="any" onModelChange={onChange} />,
    );
    expect(getByRole("combobox").textContent).toBeTruthy();

    rerender(
      <LanguageProvider>
        <ModelPicker model="veo-3" onModelChange={onChange} />
      </LanguageProvider>,
    );
    // After prop change, flash state runs — trigger must still render.
    expect(getByRole("combobox")).toBeInTheDocument();
  });

  it("keeps a thumb-friendly tap height on the trigger (regression guard)", () => {
    const { getByRole } = renderWithProviders(
      <ModelPicker model="any" onModelChange={() => {}} />,
    );
    const trigger = getByRole("combobox");
    expect(trigger.className).toMatch(/min-h-\[4rem\]/);
  });

  it("does not truncate item labels (regression guard for clipped descriptions)", () => {
    // The dropdown rows must allow wrapping, not truncate, so long
    // descriptions remain fully readable on the right edge.
    const src = require("fs").readFileSync(
      require("path").resolve(__dirname, "../ModelPicker.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/truncate/);
    expect(src).toMatch(/break-words/);
    expect(src).toMatch(/items-start/);
  });
});
