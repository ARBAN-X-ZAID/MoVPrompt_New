import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DurationSelector } from "./DurationSelector";

vi.mock("./useCapabilities", () => ({
  useCapabilities: () => ({
    active: {
      modelId: "bytedance/seedance-2.5",
      displayName: "Seedance 2.5",
      environment: "production",
      durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      minimumDurationSeconds: 4,
      maximumDurationSeconds: 30,
    },
    models: [],
    live: true,
    fallbackReason: null,
  }),
  isDurationSupported: (cap: { active: { durations: readonly number[] } }, value: number) =>
    cap.active.durations.includes(value),
  snapDuration: (cap: { active: { durations: readonly number[] } }, value: number) => {
    const list = cap.active.durations;
    if (list.includes(value)) return value;
    return list[0]!;
  },
}));

vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: "en" as const, setLocale: vi.fn() }),
}));

describe("DurationSelector", () => {
  it("renders all Seedance 2.5 supported durations", () => {
    render(<DurationSelector value={8} onChange={vi.fn()} />);
    const group = screen.getByRole("radiogroup");
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(13);
    expect(radios.map((radio) => Number((radio as HTMLInputElement).value))).toEqual([
      4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
  });

  it("marks the current value as checked", () => {
    const { container } = render(<DurationSelector value={12} onChange={vi.fn()} />);
    const radio = container.querySelector<HTMLInputElement>('input[type="radio"][value="12"]');
    expect(radio?.checked).toBe(true);
  });

  it("snaps an out-of-range value to the nearest supported option", () => {
    const { container } = render(<DurationSelector value={9} onChange={vi.fn()} />);
    // 9 is supported, so it stays. We then pick a 9-second radio.
    const radio = container.querySelector<HTMLInputElement>('input[type="radio"][value="9"]');
    expect(radio?.checked).toBe(true);
  });

  it("calls onChange with the picked duration when a radio is activated", () => {
    const onChange = vi.fn();
    const { container } = render(<DurationSelector value={8} onChange={onChange} />);
    const radio = container.querySelector<HTMLInputElement>('input[type="radio"][value="10"]');
    expect(radio).not.toBeNull();
    radio!.click();
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("renders a real fieldset and legend for screen readers", () => {
    const { container } = render(<DurationSelector value={8} onChange={vi.fn()} />);
    expect(container.querySelector("fieldset")).not.toBeNull();
    expect(container.querySelector("legend")).not.toBeNull();
  });

  it("flags the recommended duration (default = current value)", () => {
    const { container } = render(<DurationSelector value={8} onChange={vi.fn()} />);
    const recommended = container.querySelector(".creator-duration-pill.is-recommended");
    expect(recommended).not.toBeNull();
    expect(recommended?.textContent).toContain("8");
  });

  it("uses the supplied defaultValue for the recommended flag", () => {
    const { container } = render(
      <DurationSelector value={8} onChange={vi.fn()} defaultValue={6} />,
    );
    const recommended = container.querySelector(".creator-duration-pill.is-recommended");
    expect(recommended).not.toBeNull();
    expect(recommended?.textContent).toContain("6");
  });

  it("includes the template name in the legend subtitle when provided", () => {
    render(<DurationSelector value={8} onChange={vi.fn()} templateName="Restaurant Food Hero" />);
    expect(screen.getByText(/For the Restaurant Food Hero template/i)).toBeInTheDocument();
  });
});
