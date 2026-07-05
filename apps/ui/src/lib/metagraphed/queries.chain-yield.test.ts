import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "./client";
import { apiFetch } from "./client";
import { chainYieldQuery, normalizeChainYield, normalizeYieldDistributionOrNull } from "./queries";

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(apiFetch);

function resolveWith(data: unknown): void {
  mockedApiFetch.mockResolvedValue({
    data,
    meta: {} as ApiResult<unknown>["meta"],
    url: "/api/v1/chain/yield",
  });
}

async function runChainYieldQuery() {
  const opts = chainYieldQuery();
  if (!opts.queryFn) throw new Error("expected a queryFn");
  return opts.queryFn({
    signal: new AbortController().signal,
    queryKey: opts.queryKey,
    meta: undefined,
  } as unknown as Parameters<NonNullable<typeof opts.queryFn>>[0]);
}

describe("normalizeYieldDistributionOrNull", () => {
  it("normalizes percentile fields with a required count", () => {
    expect(
      normalizeYieldDistributionOrNull({
        count: 3,
        mean: 0.05,
        median: 0.04,
        min: 0.01,
        max: 0.09,
        p10: 0.02,
        p90: 0.08,
      }),
    ).toEqual({
      count: 3,
      mean: 0.05,
      median: 0.04,
      min: 0.01,
      max: 0.09,
      p10: 0.02,
      p25: null,
      p75: null,
      p90: 0.08,
    });
  });

  it("returns null for cold-store null and zero-count distributions", () => {
    expect(normalizeYieldDistributionOrNull(null)).toBeNull();
    expect(normalizeYieldDistributionOrNull({ count: 0 })).toBeNull();
    expect(normalizeYieldDistributionOrNull({})).toBeNull();
  });
});

describe("normalizeChainYield", () => {
  it("maps network yield aggregates and role splits", () => {
    expect(
      normalizeChainYield({
        schema_version: 1,
        subnet_count: 2,
        neuron_count: 3,
        validator_count: 2,
        miner_count: 1,
        captured_at: "2026-06-27T00:00:00Z",
        total_stake_tao: 1100,
        total_emission_tao: 60,
        network_yield: 0.054545,
        validator_yield: 0.05,
        miner_yield: 0.1,
        distribution: {
          count: 3,
          mean: 0.05,
          median: 0.05,
          min: 0.04,
          max: 0.06,
        },
      }),
    ).toMatchObject({
      schema_version: 1,
      subnet_count: 2,
      neuron_count: 3,
      network_yield: 0.054545,
      validator_yield: 0.05,
      miner_yield: 0.1,
      distribution: { count: 3, mean: 0.05, median: 0.05 },
    });
  });

  it("falls back to schema-stable null blocks on a cold body", () => {
    expect(
      normalizeChainYield({
        schema_version: 1,
        subnet_count: 0,
        neuron_count: 0,
        captured_at: null,
        network_yield: null,
        validator_yield: null,
        miner_yield: null,
        distribution: null,
      }),
    ).toEqual({
      schema_version: 1,
      subnet_count: 0,
      neuron_count: 0,
      validator_count: undefined,
      miner_count: undefined,
      captured_at: null,
      total_stake_tao: undefined,
      total_emission_tao: undefined,
      network_yield: null,
      validator_yield: null,
      miner_yield: null,
      distribution: null,
    });
  });
});

describe("chainYieldQuery", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("fetches and normalizes the network yield artifact", async () => {
    resolveWith({
      schema_version: 1,
      subnet_count: 1,
      neuron_count: 2,
      captured_at: "2026-01-01T00:00:00Z",
      network_yield: 0.05,
      validator_yield: 0.04,
      miner_yield: null,
      distribution: { count: 2, mean: 0.05, median: 0.05 },
    });

    const result = await runChainYieldQuery();
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/v1/chain/yield", {
      signal: expect.any(AbortSignal),
    });
    expect(result.data.network_yield).toBe(0.05);
    expect(result.data.distribution).toMatchObject({ count: 2, mean: 0.05 });
  });
});
