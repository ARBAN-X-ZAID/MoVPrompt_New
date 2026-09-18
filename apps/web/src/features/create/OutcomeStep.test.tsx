import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutcomeStep } from "./OutcomeStep";

describe("template purposes", () => {
  it("shows only allowed purposes and cycles keyboard focus within those choices", () => {
    const onChange = vi.fn();
    render(<OutcomeStep value="bookings" goals={["demonstration", "launch"]} onChange={onChange} />);
    expect(screen.queryByRole("radio", { name: /Get bookings/ })).toBeNull();
    const first = screen.getByRole("radio", { name: /Launch something new/ });
    expect(first).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("demonstration");
    expect(screen.getByRole("radio", { name: /Explain how it works/ })).toHaveFocus();
  });
});
