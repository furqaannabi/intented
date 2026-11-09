"use client";

import { useEffect, useState } from "react";
import type { Proposal } from "./proposal";

const POLL_MS = 3000;
const PAGE = 100; // the API returns at most this many changes per call

/**
 * A wallet's proposals, newest first, kept current by polling the API every 3 seconds for the ones created or
 * changed since the last seen. `proposals` is null until the first answer; `online` is false while the API can't be reached.
 */
export function useProposals(walletId: string): { proposals: Proposal[] | null; online: boolean } {
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let live = true;
    let since = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let more = false;
      try {
        const res = await fetch(`/api/proposals?since=${since}&wallet=${encodeURIComponent(walletId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const changed: Proposal[] = await res.json();
        if (!live) return;
        setOnline(true);
        setProposals((prev) => {
          const byId = new Map((prev ?? []).map((p) => [p.id, p]));
          for (const p of changed) byId.set(p.id, p);
          return [...byId.values()].sort((a, b) => b.created_at - a.created_at);
        });
        for (const p of changed) since = Math.max(since, p.updated_at);
        more = changed.length === PAGE;
      } catch {
        if (live) setOnline(false);
      }
      if (live) timer = setTimeout(poll, more ? 0 : POLL_MS);
    };
    poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [walletId]);

  return { proposals, online };
}
