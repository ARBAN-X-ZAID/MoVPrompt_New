import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({ reduce: false }));
vi.mock("framer-motion", () => ({ useReducedMotion: () => motion.reduce }));

import { AuthShowcaseWall } from "./AuthShowcaseWall";

describe("AuthShowcaseWall", () => {
  let play: ReturnType<typeof vi.spyOn>;
  let pause: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    motion.reduce = false;
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps preview videos playing on the sign-in page and releases them when the page is left", () => {
    const { container, unmount } = render(<AuthShowcaseWall />);
    const wall = container.querySelector(".auth-wall")!;
    expect(wall).toHaveAttribute("aria-hidden", "true");
    expect(wall.querySelector(".auth-wall-toggle")).toBeNull();
    const videos = [...wall.querySelectorAll("video")];
    expect(videos.length).toBeGreaterThan(0);
    expect(play).toHaveBeenCalled();

    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    unmount();
    expect(pause).toHaveBeenCalled();
    expect(load).toHaveBeenCalled();
    for (const video of videos) expect(video.getAttribute("src")).toBeNull();
  });

  it("renders a still poster grid without video under reduced motion", () => {
    motion.reduce = true;
    const { container } = render(<AuthShowcaseWall />);
    expect(container.querySelector(".auth-wall")).toHaveAttribute("data-static", "true");
    expect(container.querySelectorAll("video")).toHaveLength(0);
    expect(container.querySelectorAll(".auth-wall-tile img").length).toBeGreaterThan(0);
  });
});
