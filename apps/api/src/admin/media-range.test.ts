import { expect, it } from "vitest";
import { parseAdminMediaRange } from "./media-range.js";
it("handles ordinary, open-ended, suffix and oversized-end ranges", () => {
  expect(parseAdminMediaRange(undefined, 100)).toBeNull();
  expect(parseAdminMediaRange("bytes=0-7", 100)).toEqual({ start: 0, end: 7 });
  expect(parseAdminMediaRange("bytes=80-", 100)).toEqual({
    start: 80,
    end: 99,
  });
  expect(parseAdminMediaRange("bytes=-8", 100)).toEqual({ start: 92, end: 99 });
  expect(parseAdminMediaRange("bytes=50-200", 100)).toEqual({
    start: 50,
    end: 99,
  });
  for (const range of [
    "bytes=100-",
    "bytes=-0",
    "bytes=90-20",
    "bytes=0-1,5-6",
    "bytes=0-NaN",
    "bytes=-",
  ])
    expect(parseAdminMediaRange(range, 100)).toBe(false);
});
