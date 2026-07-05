import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { AppShell } from "@/components/metagraphed/app-shell";
import { ApiSourceFooter } from "@/components/metagraphed/api-source-footer";
import { EmptyState, Skeleton } from "@/components/metagraphed/states";
import { PageHero } from "@/components/metagraphed/page-hero";
import { ListShell } from "@/components/metagraphed/list-shell";
import { KeyChip } from "@/components/metagraphed/key-chip";
import { TimeAgo } from "@/components/metagraphed/time-ago";
import { QueryErrorBoundary } from "@/components/metagraphed/error-boundary";
import { ShareButton } from "@/components/metagraphed/share-button";
import {
  PageSizeSelect,
  ResetFiltersButton,
  SearchInput,
  SelectFilter,
} from "@/components/metagraphed/table-controls";
import { taoCompact } from "@/components/metagraphed/neuron-table";
import { validatorsQuery } from "@/lib/metagraphed/queries";
import { formatNumber } from "@/lib/metagraphed/format";
import { matchesQuery } from "@/lib/metagraphed/url-state";
import type { GlobalValidator, GlobalValidatorSort } from "@/lib/metagraphed/types";

const SORT_VALUES = [
  "subnet_count",
  "uid_count",
  "total_stake",
  "total_emission",
  "stake_dominance",
  "avg_validator_trust",
  "max_validator_trust",
] as const satisfies readonly GlobalValidatorSort[];

const validatorsSearchSchema = z.object({
  sort: fallback(z.enum(SORT_VALUES), "subnet_count").default("subnet_count"),
  limit: fallback(z.number().int().min(1).max(100), 20).default(20),
  q: fallback(z.string(), "").default(""),
});

const SORT_OPTIONS = [
  { value: "subnet_count", label: "Subnet footprint" },
  { value: "uid_count", label: "UID footprint" },
  { value: "total_stake", label: "Total stake" },
  { value: "total_emission", label: "Total emission" },
  { value: "stake_dominance", label: "Stake dominance" },
  { value: "avg_validator_trust", label: "Avg validator trust" },
  { value: "max_validator_trust", label: "Max validator trust" },
] as const;

export const Route = createFileRoute("/validators/")({
  validateSearch: zodValidator(validatorsSearchSchema),
  head: () => ({
    meta: [
      { title: "Validators — Metagraphed" },
      {
        name: "description",
        content:
          "Network-wide validator and operator leaderboard grouped by hotkey across every current subnet membership.",
      },
      { property: "og:title", content: "Validators — Metagraphed" },
      {
        property: "og:description",
        content:
          "Network-wide validator and operator leaderboard grouped by hotkey across every current subnet membership.",
      },
    ],
  }),
  component: ValidatorsPage,
});

function ValidatorsPage() {
  return (
    <AppShell>
      <PageHero
        eyebrow="Explorer"
        live
        title="Validators"
        description="Validator-permit identities grouped by hotkey across all current subnet memberships — ranked by footprint, trust, and cross-subnet stake."
        actions={<ShareButton />}
      />
      <QueryErrorBoundary>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <ValidatorsDirectory />
        </Suspense>
      </QueryErrorBoundary>
      <ApiSourceFooter paths={["/api/v1/validators"]} artifacts={["/metagraph/validators.json"]} />
    </AppShell>
  );
}

function pct(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

function trust(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(3);
}

function ValidatorsDirectory() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: res } = useSuspenseQuery(
    validatorsQuery({ sort: search.sort, limit: search.limit }),
  );
  const payload = res.data;
  const rows = useMemo(() => {
    const needle = search.q.trim();
    const validators = payload.validators ?? [];
    if (!needle) return validators;
    return validators.filter((row) =>
      matchesQuery([row.hotkey, row.coldkey, row.subnet_count, row.uid_count], needle),
    );
  }, [payload.validators, search.q]);

  const setSearch = (patch: Record<string, unknown>) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }) as never });

  const filtersActive = !!search.q || search.sort !== "subnet_count" || search.limit !== 20;

  const filters = (
    <>
      <SearchInput
        value={search.q}
        onChange={(v) => setSearch({ q: v })}
        placeholder="Filter hotkey / coldkey…"
      />
      <SelectFilter
        label="Sort"
        value={search.sort}
        onChange={(v) => setSearch({ sort: v as GlobalValidatorSort })}
        options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      />
      <PageSizeSelect
        value={search.limit}
        onChange={(n) => setSearch({ limit: n })}
        options={[10, 20, 50, 100]}
      />
      <ResetFiltersButton
        active={filtersActive}
        onReset={() => setSearch({ q: "", sort: "subnet_count", limit: 20 })}
      />
    </>
  );

  const emptyNode = (
    <EmptyState
      title="No validators indexed yet"
      description="The neurons snapshot has no validator-permit rows for this network partition — check back after the next metagraph capture."
    />
  );

  const footerNode = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/30 px-4 py-2 text-[11px] font-mono text-ink-muted">
      <span>
        {rows.length
          ? `${formatNumber(rows.length)} shown · ${formatNumber(payload.validator_count ?? rows.length)} total`
          : "0 validators"}
        {res.meta?.captured_at ? (
          <>
            {" "}
            · snapshot <TimeAgo at={res.meta.captured_at} />
          </>
        ) : null}
      </span>
      <span>sort={payload.sort ?? search.sort}</span>
    </div>
  );

  return (
    <ListShell
      filters={filters}
      isEmpty={rows.length === 0}
      empty={emptyNode}
      footer={footerNode}
      table={
        <table className="w-full text-left text-sm">
          <thead className="sticky top-sticky-offset z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-[0_1px_0_0_var(--border)]">
            <tr>
              <th className="px-4 py-2.5">Hotkey</th>
              <th className="px-4 py-2.5 text-right">Subnets</th>
              <th className="px-4 py-2.5 text-right">UIDs</th>
              <th className="px-4 py-2.5 text-right">Total stake</th>
              <th className="px-4 py-2.5 text-right">Total emission</th>
              <th className="px-4 py-2.5 text-right">Dominance</th>
              <th className="px-4 py-2.5 text-right">Avg trust</th>
              <th className="px-4 py-2.5 text-right">Max trust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <ValidatorRow key={row.hotkey} row={row} />
            ))}
          </tbody>
        </table>
      }
    />
  );
}

function ValidatorRow({ row }: { row: GlobalValidator }) {
  return (
    <tr className="hover:bg-surface/40">
      <td className="px-4 py-2.5">
        <Link
          to="/accounts/$ss58"
          params={{ ss58: row.hotkey }}
          className="inline-flex min-w-0 max-w-full items-center gap-2 font-medium text-accent hover:underline"
        >
          <KeyChip value={row.hotkey} label="hotkey" />
        </Link>
      </td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.subnet_count}</td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.uid_count}</td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
        {taoCompact(row.total_stake_tao)} τ
      </td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
        {taoCompact(row.total_emission_tao)} τ
      </td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{pct(row.stake_dominance)}</td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
        {trust(row.avg_validator_trust)}
      </td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
        {trust(row.max_validator_trust)}
      </td>
    </tr>
  );
}
