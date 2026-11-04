"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Cross } from "../components/icons";
import { Receipt } from "../components/Receipt";
import { Tag } from "../components/Tag";
import { nearblocksAccount, WALLET_ID, walletFromParam } from "../lib/near";
import { amount, outcome, OUTCOME_LABEL, payee, shortAddress, splitReason, type Outcome, type Proposal } from "../lib/proposal";
import { Loading, Skeleton } from "../components/Skeleton";
import "./activity.css";

const POLL_MS = 3000;
const PAGE = 100; // the API returns at most this many changes per call

const BADGE: Record<Outcome, string> = {
  paid: "bg-lime text-lime-ink",
  refused: "bg-coral/15 text-coral",
  failed: "bg-line text-mute",
  judging: "bg-line text-soft",
  approved: "bg-line text-soft",
  delivering: "bg-line text-soft",
  delivered: "bg-lime text-lime-ink",
  refunded: "bg-line text-mute",
};

const STATUS: Record<Outcome, string> = {
  paid: "text-lime",
  refused: "text-coral",
  failed: "text-mute",
  judging: "text-soft",
  approved: "text-soft",
  delivering: "text-soft",
  delivered: "text-lime",
  refunded: "text-mute",
};

function Badge({ kind }: { kind: Outcome }) {
  return (
    <span className={`grid size-[34px] shrink-0 place-items-center rounded-[11px] ${BADGE[kind]}`} aria-hidden="true">
      {(kind === "paid" || kind === "delivered") && <Check className="size-4" />}
      {kind === "refused" && <Cross className="size-4" />}
      {(kind === "failed" || kind === "refunded") && <span className="h-0.5 w-2.5 rounded bg-current" />}
      {(kind === "judging" || kind === "approved" || kind === "delivering") && <span className="act-dots" />}
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
          <span className="flex items-center gap-2 font-mono text-sm font-medium">
            <span className="truncate">{p.oneclick ? shortAddress(payee(p)) : payee(p)}</span>
            {p.oneclick && <Tag>{p.oneclick.dest_chain}</Tag>}
          </span>
          <span className="block truncate text-[13px] text-mute">{signed || error || "Waiting for a verdict"}</span>
        </span>
        <span className="text-right">
          <span className={`block font-mono text-sm whitespace-nowrap ${kind === "refused" ? "text-mute line-through" : ""}`}>
            −{amount(p)}
          </span>
          {/* On a phone the "simulated" tag goes under the status, so the recipient keeps its width. */}
          <span
            className={`mt-0.5 flex items-center justify-end gap-x-1.5 gap-y-1 text-[11px] font-black tracking-[0.12em] whitespace-nowrap uppercase max-sm:flex-col max-sm:items-end ${STATUS[kind]}`}
          >
            <span>{OUTCOME_LABEL[kind]}</span>
            {p.oneclick?.simulated && kind === "delivered" && <Tag dashed>simulated</Tag>}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * The heading and the payments of the wallet named by ?wallet=, our own by default. The API's proposals carry no wallet
 * and are all intented-wallet.testnet's, so another wallet gets a plain "not served yet", never our wallet's list.
 */
export function ActivityView() {
  const param = useSearchParams().get("wallet");
  const walletId = walletFromParam(param);
  return (
    <>
      <div className="pt-10 pb-4">
        <h1 className="text-[clamp(34px,4vw,56px)] leading-none font-black tracking-[-0.035em]">Activity</h1>
        <p className="mt-3 text-sm text-mute">
          Wallet <span className="font-mono break-all text-text">{walletId ?? param}</span> on NEAR testnet
          {walletId === WALLET_ID && (
            <>
              {" "}
              · every verdict signed in a TEE on NEAR AI Cloud ·{" "}
              <Link href="/rules" className="text-text underline decoration-line underline-offset-4 hover:decoration-soft">
                the rules it pays by
              </Link>
            </>
          )}
        </p>
      </div>
      {walletId === WALLET_ID ? (
        <Activity />
      ) : (
        <p className="my-6 max-w-[44em] rounded-[18px] border border-line bg-ink-2 p-5 text-sm text-mute">
          {walletId ? (
            <>
              <b className="font-bold text-text">No payments shown for this wallet yet.</b> Intented&apos;s API judges and records payments for{" "}
              <span className="font-mono">{WALLET_ID}</span> only today. Everything this wallet has done is on{" "}
              <a href={nearblocksAccount(walletId)} className="text-text underline decoration-line underline-offset-4 hover:decoration-soft">
                nearblocks
              </a>
              .
            </>
          ) : (
            <>
              That isn&apos;t an Intented wallet. Wallets are <span className="font-mono">{WALLET_ID}</span> or a name ending in{" "}
              <span className="font-mono">.intented.testnet</span>.
            </>
          )}
        </p>
      )}
    </>
  );
}

function Activity() {
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
    return online ? <PaymentsSkeleton /> : <p className="py-10 text-mute">Can&apos;t reach the API. Retrying every 3 seconds.</p>;
  }

  // What the wallet did: a payment through 1Click counts as paid once the wallet has paid the deposit.
  const counts = { paid: 0, refused: 0, failed: 0 };
  for (const p of proposals) {
    if (p.status === "executed") counts.paid++;
    else if (p.status === "denied") counts.refused++;
    else if (p.status === "failed") counts.failed++;
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

/** The payments list and receipt while the first poll is in flight. */
function PaymentsSkeleton() {
  return (
    <Loading label="Loading payments">
      <div className="flex flex-wrap items-end justify-between gap-6 pb-6">
        <Skeleton className="h-4 w-72 max-w-full" />
        <div className="flex gap-7 text-[13px] leading-tight text-mute">
          {["paid", "refused", "failed"].map((k) => (
            <div key={k} className="flex flex-col-reverse">
              <span>{k}</span>
              <Skeleton className="mb-1 h-7 w-7" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 pb-20 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        <ul className="border-t border-line [&>li]:border-b [&>li]:border-line">
          {["w-3/5", "w-2/3", "w-1/2", "w-3/5", "w-2/5"].map((w, i) => (
            <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 px-3.5 py-4">
              <Skeleton className="size-[34px] rounded-[11px]" />
              <span className="min-w-0">
                <Skeleton className={`h-4 ${w}`} />
                <Skeleton className="mt-2 h-3 w-4/5" />
              </span>
              <span className="grid justify-items-end">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="mt-2 h-3 w-12" />
              </span>
            </li>
          ))}
        </ul>
        <div className="rounded-[22px] border border-line bg-ink-2 p-7 max-lg:hidden">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-8 w-1/2" />
          <div className="mt-6 grid gap-3">
            {["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3"].map((w, i) => (
              <Skeleton key={i} className={`h-3.5 ${w}`} />
            ))}
          </div>
        </div>
      </div>
    </Loading>
  );
}

/** /activity before it can read ?wallet=: the heading, then the list's shape. */
export function ActivitySkeleton() {
  return (
    <>
      <div className="pt-10 pb-4">
        <h1 className="text-[clamp(34px,4vw,56px)] leading-none font-black tracking-[-0.035em]">Activity</h1>
        <Skeleton className="mt-4 h-4 w-96 max-w-full" />
      </div>
      <PaymentsSkeleton />
    </>
  );
}
