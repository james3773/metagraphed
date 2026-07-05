import { describe, expect, it } from "vitest";

import {
  DEFAULT_POLLING_INTERVAL_MS,
  STATUS_POLLING_INTERVAL_MS,
  resolveRefetchInterval,
} from "./use-polling-interval";

describe("resolveRefetchInterval", () => {
  it("returns the interval when polling is enabled and the tab is visible", () => {
    expect(resolveRefetchInterval(true, true, DEFAULT_POLLING_INTERVAL_MS)).toBe(30_000);
    expect(resolveRefetchInterval(true, true, STATUS_POLLING_INTERVAL_MS)).toBe(60_000);
  });

  it("pauses polling when disabled, hidden, or interval is non-positive", () => {
    expect(resolveRefetchInterval(false, true, 30_000)).toBe(false);
    expect(resolveRefetchInterval(true, false, 30_000)).toBe(false);
    expect(resolveRefetchInterval(true, true, 0)).toBe(false);
    expect(resolveRefetchInterval(true, true, -1)).toBe(false);
  });
});
