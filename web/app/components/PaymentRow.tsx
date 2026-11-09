"use client";

import Link from "next/link";
import { Check, Cross } from "./icons";
import { Tag } from "./Tag";
import { WALLET_ID } from "../lib/near";
import { amount, outcome, OUTCOME_LABEL, payee, shortAddress, splitReason, type Outcome, type Proposal } from "../lib/proposal";
import "../activity/activity.css";

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

/** A wallet's Activity page; the demo wallet's is plain /activity. */
export const activityPage = (walletId: string) => (walletId === WALLET_ID ? "/activity" : `/activity?wallet=${walletId}`);

/** One payment: who, the verdict's reason, the amount and where it stands. Links to its receipt on `page`. */
export function PaymentRow({ proposal: p, selected = false, page }: { proposal: Proposal; selected?: boolean; page: string }) {
  const kind = outcome(p);
  const { signed, error } = splitReason(p);
  return (
    <li>
      <Link
        href={`${page}${page.includes("?") ? "&" : "?"}p=${p.id}`}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-[14px] px-3.5 py-4 transition-colors hover:bg-ink-2 max-sm:grid-cols-[auto_minmax(0,1fr)] max-sm:items-start max-sm:gap-y-2 ${
          selected ? "bg-ink-2 ring-1 ring-line ring-inset" : ""
        }`}
      >
        <Badge kind={kind} />
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-mono text-sm font-medium">
            <span className="truncate">{p.oneclick ? shortAddress(payee(p)) : payee(p)}</span>
            {p.oneclick && <Tag>{p.oneclick.dest_chain}</Tag>}
          </span>
          {/* On a phone the reason gets two lines, not a few words. */}
          <span className="block truncate text-[13px] text-mute max-sm:line-clamp-2 max-sm:whitespace-normal">{signed || error || "Waiting for a verdict"}</span>
        </span>
        {/* On a phone the amount and status get their own line under the recipient, so the recipient keeps the full width. */}
        <span className="text-right max-sm:col-start-2 max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:text-left">
          <span className={`block font-mono text-sm whitespace-nowrap ${kind === "refused" ? "text-mute line-through" : ""}`}>
            −{amount(p)}
          </span>
          <span
            className={`mt-0.5 flex items-center justify-end gap-x-1.5 text-[11px] font-black tracking-[0.12em] whitespace-nowrap uppercase max-sm:mt-0 ${STATUS[kind]}`}
          >
            <span>{OUTCOME_LABEL[kind]}</span>
            {p.oneclick?.simulated && kind === "delivered" && <Tag dashed>simulated</Tag>}
          </span>
        </span>
      </Link>
    </li>
  );
}
