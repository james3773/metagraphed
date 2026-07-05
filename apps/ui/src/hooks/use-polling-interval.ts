import { useEffect, useState } from "react";

/** Default auto-refresh cadence on /health (30s). */
export const DEFAULT_POLLING_INTERVAL_MS = 30_000;

/** Fixed poll cadence on /status (60s). */
export const STATUS_POLLING_INTERVAL_MS = 60_000;

/**
 * TanStack Query `refetchInterval` value: `false` pauses polling when the tab
 * is hidden or the user has paused refresh.
 */
export function resolveRefetchInterval(
  enabled: boolean,
  visible: boolean,
  intervalMs: number,
): number | false {
  if (!enabled || !visible || intervalMs <= 0) return false;
  return intervalMs;
}

/** Returns true when the document is visible (or true during SSR). */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/**
 * Reusable poll interval for live freshness / health queries. Pauses when the
 * tab is hidden or `enabled` is false; returns a ms value suitable for
 * TanStack Query's `refetchInterval`.
 */
export function usePollingInterval({
  enabled = true,
  intervalMs = DEFAULT_POLLING_INTERVAL_MS,
}: {
  enabled?: boolean;
  intervalMs?: number;
} = {}): number | false {
  const visible = usePageVisible();
  return resolveRefetchInterval(enabled, visible, intervalMs);
}
