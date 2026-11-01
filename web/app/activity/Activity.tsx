"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Cross } from "../components/icons";
import { Receipt } from "../components/Receipt";
import { amount, outcome, OUTCOME_LABEL, payee, splitReason, type Outcome, type Proposal } from "../lib/proposal";
import "./activity.css";

const POLL_MS = 3000;
const PAGE = 100; // the API returns at most this many changes per call

const BADGE: Record<Outcome, string> = {
  paid: "bg-lime text-lime-ink",
  refused: "bg-coral/15 text-coral",
  failed: "bg-[#1b1b44] text-mute",
  judging: "bg-[#1b1b44] text-soft",
  approved: "bg-[#1b1b44] text-soft",
};

const STATUS: Record<Outcome, string> = {
  paid: "text-lime",
  refused: "text-coral",
  failed: "text-mute",
  judging: "text-soft",
  approved: "text-soft",
};

function Badge({ kind }: { kind: Outcome }) {
  return (
    <span className={`grid size-[34px] shrink-0 place-items-center rounded-[11px] ${BADGE[kind]}`} aria-hidden="true">
      {kind === "paid" && <Check className="size-4" />}
      {kind === "refused" && <Cross className="size-4" />}
      {kind === "failed" && <span className="h-0.5 w-2.5 rounded bg-current" />}
      {(kind === "judging" || kind === "approved") && <span className="act-dots" />}
    </span>
  );
}

function Row({ proposal: p, selected }: { proposal: Proposal; selected: boolean }) {
  const kind = outcome(p);
  const { signed, error } = splitReason(p);
  return (
    <li>
      <Link
        href={`/activity?p=${p.id}`}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-[14px] px-3.5 py-4 transition-colors hover:bg-ink-2 ${
          selected ? "bg-ink-2 ring-1 ring-line ring-inset" : ""
        }`}
      >
        <Badge kind={kind} />
        <span className="min-w-0">
          <span className="block truncate font-mono text-sm font-medium">{payee(p)}</span>
          <span className="block truncate text-[13px] text-mute">{signed || error || "Waiting for a verdict"}</span>
        </span>
        <span className="text-right">
          <span className={`block font-mono text-sm whitespace-nowrap ${kind === "refused" ? "text-mute line-through" : ""}`}>
            −{amount(p)}
          </span>
          <span className={`mt-0.5 block text-[11px] font-black tracking-[0.12em] uppercase ${STATUS[kind]}`}>
            {OUTCOME_LABEL[kind]}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function Activity() {
  const selectedId = useSearchParams().get("p");
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [online, setOnline] = useState(true);

  // Poll for proposals created or changed since the last one seen.
  useEffect(() => {
    let live = true;
    let since = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let more = false;
      try {
        const res = await fetch(`/api/proposals?since=${since}`, { cache: "no-store" });
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
  }, []);

  // On a phone the receipt replaces the list, so start it at the top.
  useEffect(() => {
    if (selectedId && window.matchMedia("(max-width: 1023px)").matches) window.scrollTo(0, 0);
  }, [selectedId]);

  if (!proposals) {
    return <p className="py-10 text-mute">{online ? "Loading payments…" : "Can't reach the API. Retrying every 3 seconds."}</p>;
  }

  const counts = { paid: 0, refused: 0, failed: 0 };
  for (const p of proposals) {
    const kind = outcome(p);
    if (kind in counts) counts[kind as keyof typeof counts]++;
  }
  const selected = proposals.find((p) => p.id === (selectedId ?? proposals[0]?.id));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6 pb-6">
        <p className="inline-flex items-center gap-2 text-sm text-mute" aria-live="polite">
          <span className={`act-ping ${online ? "" : "act-offline"}`} aria-hidden="true" />
          {online ? "Live · every payment the agent proposed, newest first" : "Can't reach the API. Retrying every 3 seconds."}
        </p>
        <dl className="flex gap-7 text-[13px] leading-tight text-mute">
          {(
            [
              ["paid", "text-lime"],
              ["refused", "text-coral"],
              ["failed", "text-text"],
            ] as const
          ).map(([key, colour]) => (
            <div key={key} className="flex flex-col-reverse">
              <dt>{key}</dt>
              <dd className={`text-[26px] font-black tracking-[-0.02em] ${colour}`}>{counts[key]}</dd>
            </div>
          ))}
        </dl>
      </div>

      {proposals.length === 0 ? (
        <p className="border-t border-line py-10 text-mute">No payments yet. They appear here as soon as the agent proposes one.</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 pb-20 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
          <ul className={`border-t border-line [&>li]:border-b [&>li]:border-line ${selectedId ? "max-lg:hidden" : ""}`}>
            {proposals.map((p) => (
              <Row key={p.id} proposal={p} selected={p.id === selected?.id} />
            ))}
          </ul>
          <div className={`lg:sticky lg:top-24 ${selectedId ? "" : "max-lg:hidden"}`}>
            <Link href="/activity" scroll={false} className="mb-4 inline-flex items-center gap-1.5 text-mute hover:text-text lg:hidden">
              <ArrowLeft className="size-4" /> All payments
            </Link>
            {selected ? (
              <Receipt proposal={selected} />
            ) : (
              <p className="rounded-[22px] border border-line bg-ink-2 p-7 text-mute">
                No payment with the id <span className="font-mono text-text">{selectedId}</span>.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
