import { describe, expect, it } from "vitest";

import { extrinsicCall, extrinsicHashPathSegment, isValidExtrinsicHash } from "./extrinsics";

const VALID_HASH = "0xabc123def456";

describe("isValidExtrinsicHash", () => {
  it("accepts 0x-prefixed hex extrinsic hashes", () => {
    expect(isValidExtrinsicHash(VALID_HASH)).toBe(true);
    expect(isValidExtrinsicHash("0xDEADBEEF")).toBe(true);
    expect(isValidExtrinsicHash(`0x${"a".repeat(128)}`)).toBe(true);
  });

  it("rejects malformed hash refs", () => {
    expect(isValidExtrinsicHash("")).toBe(false);
    expect(isValidExtrinsicHash("abc123")).toBe(false);
    expect(isValidExtrinsicHash("0x")).toBe(false);
    expect(isValidExtrinsicHash("0xghij")).toBe(false);
    expect(isValidExtrinsicHash(`0x${"a".repeat(129)}`)).toBe(false);
  });
});

describe("extrinsicHashPathSegment", () => {
  it("returns an encoded path segment for valid hashes", () => {
    expect(extrinsicHashPathSegment(VALID_HASH)).toBe(encodeURIComponent(VALID_HASH));
  });

  it("throws before encoding invalid hash refs", () => {
    expect(() => extrinsicHashPathSegment("not-a-hash")).toThrow("Invalid extrinsic hash");
  });
});

describe("extrinsicCall", () => {
  it("joins module and function when both are present", () => {
    expect(extrinsicCall("Balances", "transfer")).toBe("Balances.transfer");
  });

  it("falls back to whichever side is present", () => {
    expect(extrinsicCall("Balances", null)).toBe("Balances");
    expect(extrinsicCall(undefined, "transfer")).toBe("transfer");
  });

  it("returns an em dash when both sides are absent", () => {
    expect(extrinsicCall()).toBe("—");
    expect(extrinsicCall(null, null)).toBe("—");
  });
});
