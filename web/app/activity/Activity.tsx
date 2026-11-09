"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft } from "../components/icons";
import { activityPage, PaymentRow } from "../components/PaymentRow";
import { Receipt } from "../components/Receipt";
import { FACTORY_ID, NETWORK_NAME, WALLET_ID, walletFromParam } from "../lib/near";
import { useProposals } from "../lib/useProposals";
import { Loading, Skeleton } from "../components/Skeleton";
import "./activity.css";

/**
 * The heading and the payments of the wallet named by ?wallet=, the demo wallet by default. A name that isn't an
 * Intented wallet gets a plain note, never another wallet's list.
 */
export function ActivityView() {
  const param = useSearchParams().get("wallet");
  const walletId = walletFromParam(param);
  return (
    <>
      <div className="pt-10 pb-4">
        <h1 className="text-[clamp(34px,4vw,56px)] leading-none font-black tracking-[-0.035em]">Activity</h1>
        <p className="mt-3 text-sm text-mute">
          Wallet <span className="font-mono break-all text-text">{walletId ?? param}</span> on {NETWORK_NAME}
          {walletId && <> · every verdict signed in a TEE on NEAR AI Cloud</>}
          {walletId === WALLET_ID && (
            <>
              {" "}
              ·{" "}
              <Link href="/rules" className="text-text underline decoration-line underline-offset-4 hover:decoration-soft">
                the rules it pays by
              </Link>
            </>
          )}
        </p>
      </div>
      {walletId ? (
        <Activity key={walletId} walletId={walletId} />
      ) : (
        <p className="my-6 max-w-[44em] rounded-[18px] border border-line bg-ink-2 p-5 text-sm text-mute">
          That isn&apos;t an Intented wallet. Wallets are <span className="font-mono">{WALLET_ID}</span>
          {FACTORY_ID ? (
            <>
              {" "}
              or a name ending in <span className="font-mono">.{FACTORY_ID}</span>
            </>
          ) : (
            <> only, on this site</>
          )}
          .
        </p>
      )}
    </>
  );
}

function Activity({ walletId }: { walletId: string }) {
  const page = activityPage(walletId);
  const selectedId = useSearchParams().get("p");
  const { proposals, online } = useProposals(walletId);

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
              <PaymentRow key={p.id} proposal={p} selected={p.id === selected?.id} page={page} />
            ))}
          </ul>
          <div className={`lg:sticky lg:top-24 ${selectedId ? "" : "max-lg:hidden"}`}>
            <Link href={page} scroll={false} className="mb-4 inline-flex items-center gap-1.5 text-mute hover:text-text lg:hidden">
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
