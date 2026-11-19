import { useEffect, useState } from "react";
import type { YesterdayBestScope } from "@/types/komari";
import {
  calculateYesterdayBestLeaderboard,
  getMemoryYesterdayLeaderboardResult,
  type YesterdayLeaderboardResult,
} from "@/utils/yesterdayBestNode";

export function useYesterdayBestLeaderboard(
  candidateUuids: string[],
  scope: YesterdayBestScope,
  includeIpv6: boolean,
  enabled = true,
) {
  const selectionKey = JSON.stringify([scope, includeIpv6, candidateUuids]);
  const [loaded, setLoaded] = useState<{
    selectionKey: string;
    result: YesterdayLeaderboardResult;
  }>();

  useEffect(() => {
    if (!enabled || candidateUuids.length === 0) return;

    let active = true;
    void calculateYesterdayBestLeaderboard(candidateUuids, { scope, includeIpv6 }).then((result) => {
      if (active) setLoaded({ selectionKey, result });
    });
    return () => {
      active = false;
    };
  }, [candidateUuids, enabled, includeIpv6, scope, selectionKey]);

  if (!enabled || candidateUuids.length === 0) return undefined;
  return getMemoryYesterdayLeaderboardResult(candidateUuids, { scope, includeIpv6 }) ??
    (loaded?.selectionKey === selectionKey ? loaded.result : undefined);
}
