"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FACTORY_ID, formatUnits, LABEL } from "../../lib/near";
import { ownedWallets, rememberedWallets, rememberWallet, walletFromPath, walletHref } from "../../lib/myWallets";
import { useNearWallet } from "../../lib/useNearWallet";
import { loadWallet, type WalletState } from "../../lib/walletState";
import { Loading, Skeleton } from "../../components/Skeleton";

const button = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const primary = `${button} bg-lime text-lime-ink`;
const secondary = `${button} border-[1.5px] border-line bg-ink-2 text-text hover:border-soft`;

type Row = { id: string; state: WalletState | null | "error" };

export function MyWallets() {
  const near = useNearWallet();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  // The remembered names, known before their wallets are read, so each row's skeleton can already show its name.
  const [reading, setReading] = useState<string[] | null>(null);
  const [open, setOpen] = useState("");
  const openId = walletFromPath(open.trim());

  // Waits for the connector, so a connected owner's list doesn't first show as signed out.
  const [listError, setListError] = useState(false);
  const account = near.status === "loading" ? undefined : near.account;

  // The owner's wallets from the factory, then the ones opened by name on this browser; each read from the chain.
  useEffect(() => {
    if (account === undefined) return;
    let cancelled = false;
    const remembered = rememberedWallets();
    // localStorage is only readable after hydration; the rows arrive after the awaits below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReading(remembered);
    setRows(null);
    setListError(false);
    (async () => {
      const owned = account
        ? await ownedWallets(account).catch(() => {
            if (!cancelled) setListError(true);
            return [];
          })
        : [];
      if (cancelled) return;
      // Newest first, each once: a wallet you own and also opened by name is listed as yours.
      const ids = [...new Set([...[...owned].reverse(), ...remembered])];
      setReading(ids);
      const r = await Promise.all(ids.map(async (id): Promise<Row> => ({ id, state: await loadWallet(id).catch(() => "error" as const) })));
      if (!cancelled) setRows(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [account]);

  const found = (rows ?? []).filter((r) => r.state !== null);
  const mine = near.account ? found.filter((r) => typeof r.state === "object" && r.state?.config.owner_id === near.account) : [];
  const others = found.filter((r) => !mine.includes(r));

  function openWallet(e: React.FormEvent) {
    e.preventDefault();
    if (!openId) return;
    rememberWallet(openId);
    router.push(walletHref(openId));
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5 pt-10 pb-6">
        <div>
          <h1 className="text-[clamp(34px,4.2vw,56px)] leading-none font-black tracking-[-0.035em]">My wallets</h1>
          <p className="mt-3 text-[15px] text-mute">
            {near.account ? (
              <>
                Intented wallets owned by <span className="font-mono text-text">{near.account}</span> on NEAR testnet.
              </>
            ) : (
              "Connect your NEAR wallet, top right, to see the Intented wallets you own on NEAR testnet."
            )}
          </p>
        </div>
        <Link href="/create" className={primary}>
          Create wallet
        </Link>
      </div>

      {rows === null ? (
        <Loading label="Reading your wallets from NEAR testnet">
          <div className="grid gap-3 pb-7">
            {(reading ?? [null, null]).map((id, i) => (
              <RowSkeleton key={id ?? i} id={id} />
            ))}
          </div>
        </Loading>
      ) : (
        <>
          {near.account && (
            <div className="grid gap-3 pb-7">
              {listError && (
                <p className="text-sm text-coral">Couldn&apos;t list your wallets from the factory on NEAR testnet. Reload to try again.</p>
              )}
              {mine.length ? (
                mine.map((r) => <WalletRow key={r.id} row={r} />)
              ) : (
                !listError && (
                  <p className="text-sm text-mute">
                    No wallets yet.{" "}
                    <Link href="/create" className="text-text underline decoration-line underline-offset-2 hover:decoration-soft">
                      Create one
                    </Link>
                    .
                  </p>
                )
              )}
            </div>
          )}
          {others.length > 0 && (
            <>
              {near.account && <h2 className="pb-3 text-sm font-bold text-mute">Opened on this browser, owned by someone else</h2>}
              <div className="grid gap-3 pb-7">
                {others.map((r) => (
                  <WalletRow key={r.id} row={r} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <form onSubmit={openWallet} className="mb-24 rounded-[20px] border border-dashed border-line p-6 text-sm text-mute">
        <p>
          <b className="text-text">Not listed?</b> Open a wallet by name; this browser will remember it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <label className="flex min-w-[min(100%,380px)] items-center overflow-hidden rounded-[14px] border-[1.5px] border-line bg-ink-2 focus-within:border-soft">
            <span className="sr-only">Wallet name</span>
            <input
              value={open}
              onChange={(e) => setOpen(e.target.value)}
              placeholder="my-shop"
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-mono text-sm text-text outline-none"
            />
            {!open.includes(".") && <span className="px-3.5 font-mono text-[13px] whitespace-nowrap">.{FACTORY_ID}</span>}
          </label>
          <button type="submit" disabled={!openId} className={`${secondary} py-2.5`}>
            Open
          </button>
        </div>
        {open && !openId && (
          <p className="mt-2 text-[13px] text-coral">
            {LABEL.test(open) ? "That name is too long." : "A wallet name: lowercase letters and digits, with - or _ between them."}
          </p>
        )}
        <p className="mt-3 text-[12.5px]">Your own wallets are listed from the factory on chain, on any device. Wallets you open by name are remembered on this browser only.</p>
      </form>
    </>
  );
}

function WalletRow({ row }: { row: Row }) {
  const s = row.state;
  if (s === "error" || s === null) {
    return (
      <div className="rounded-[20px] border border-line bg-ink-2 px-[22px] py-5">
        <p className="font-mono break-all">{row.id}</p>
        <p className="mt-1 text-[13px] text-coral">Couldn&apos;t read this wallet from NEAR testnet. Reload to try again.</p>
      </div>
    );
  }
  const t = s.tokens[0];
  return (
    <Link
      href={walletHref(row.id)}
      className="grid grid-cols-2 items-center gap-x-4 gap-y-3 rounded-[20px] border border-line bg-ink-2 px-[22px] py-5 hover:border-[#444] md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:gap-6"
    >
      <div className="col-span-2 min-w-0 md:col-span-1">
        <p className="font-mono font-medium break-all">{row.id}</p>
        <p className="mt-1 truncate text-[13px] text-mute">
          {s.rules.state === "live" ? s.rules.text : s.rules.state === "none" ? "No rules set: every payment is refused." : "Rules text not available."}
        </p>
      </div>
      <Stat label="Balance" value={t ? `${t.balance === null ? "—" : formatUnits(t.balance, t.token.decimals)} ${t.token.symbol}` : "—"} />
      <Stat label="Agent" value={<Pill tone={s.agentKeys.length ? "ok" : "warn"}>{s.agentKeys.length ? `${s.agentKeys.length} key${s.agentKeys.length > 1 ? "s" : ""}` : "no key"}</Pill>} />
      <Stat label="Status" value={<Pill tone={s.config.frozen ? "warn" : undefined}>{s.config.frozen ? "frozen" : "active"}</Pill>} />
    </Link>
  );
}

/** A wallet row while its wallet is read: the name if this browser remembers it, then the row's shape. */
function RowSkeleton({ id }: { id: string | null }) {
  return (
    <div className="grid grid-cols-2 items-center gap-x-4 gap-y-3 rounded-[20px] border border-line bg-ink-2 px-[22px] py-5 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:gap-6">
      <div className="col-span-2 min-w-0 md:col-span-1">
        {id ? <p className="font-mono font-medium break-all">{id}</p> : <Skeleton className="h-5 w-3/5" />}
        <Skeleton className="mt-2 h-3.5 w-4/5" />
      </div>
      <Stat label="Balance" value={<Skeleton className="mt-1 h-5 w-24" />} />
      <Stat label="Agent" value={<Skeleton className="mt-1 h-6 w-16 rounded-full" />} />
      <Stat label="Status" value={<Skeleton className="mt-1 h-6 w-16 rounded-full" />} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-mute">{label}</p>
      <div className="font-bold">{value}</div>
    </div>
  );
}

export function Pill({ tone, children }: { tone?: "ok" | "warn"; children: React.ReactNode }) {
  // Neutral, never lime or coral: those two mean ALLOW and DENY only. A warning is outlined, and its words say what it is.
  const color = tone === "ok" ? "text-soft" : tone === "warn" ? "text-text ring-1 ring-soft/60 ring-inset" : "text-soft";
  return <span className={`inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 font-mono text-xs font-medium ${color}`}>{children}</span>;
}
