"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Check, Cross } from "../components/icons";
import { REPO } from "../components/SiteHeader";
import {
  formatUnits,
  getConfig,
  getToken,
  NETWORK,
  nearblocksAccount,
  nearblocksTx,
  sha256Hex,
  WALLET_ID,
  walletFromParam,
  type WalletConfig,
  type WalletToken,
} from "../lib/near";
import { useNearWallet } from "../lib/useNearWallet";
import { RulesEditor } from "../components/RulesEditor";
import { Loading, Skeleton, Spinner } from "../components/Skeleton";

const button = "inline-flex items-center gap-2 rounded-full px-5 py-3 text-[15px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const primary = `${button} bg-lime text-lime-ink`;
const secondary = `${button} border-[1.5px] border-line bg-ink-2 text-text hover:border-soft`;

/** The rules' text, found by the wallet's hash and hashed again here before it's shown as live. */
type Text =
  | { state: "loading" }
  | { state: "none" } // the wallet has no mandate set
  | { state: "live"; text: string }
  | { state: "unavailable" } // the API couldn't give a text for this hash
  | { state: "mismatch" }; // the API gave a text whose hash isn't the wallet's

/** Viewing, editing in RulesEditor, or the outcome of the last edit. */
type Edit = { step: "view" } | { step: "edit" } | { step: "done"; tx: string } | { step: "error"; message: string };

const short = (s: string, head = 8, tail = 8) => (s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s);

/** NEAR deposits are yoctoNEAR; the wallet's caps are tiny, so show them as written. */
const nearAmount = (raw: string) => (raw.length <= 6 ? `${raw} yoctoNEAR` : `${formatUnits(raw, 24)} NEAR`);

/** The wallet named by ?wallet=, our own by default. */
export function Rules() {
  const param = useSearchParams().get("wallet");
  const walletId = walletFromParam(param);
  if (!walletId) {
    return (
      <p className="my-10 max-w-[40em] rounded-[18px] border border-line bg-ink-2 p-5 text-sm text-mute">
        <span className="font-mono break-all text-text">{param}</span> isn&apos;t an Intented wallet. Wallets are{" "}
        <span className="font-mono">{WALLET_ID}</span> or a name ending in <span className="font-mono">.intented.testnet</span>.
      </p>
    );
  }
  return <WalletRules key={walletId} walletId={walletId} />;
}

function WalletRules({ walletId }: { walletId: string }) {
  const [config, setConfig] = useState<WalletConfig | null>(null);
  const [tokens, setTokens] = useState<Record<string, WalletToken | null>>({});
  const [readError, setReadError] = useState(false);
  const [text, setText] = useState<Text>({ state: "loading" });
  const [edit, setEdit] = useState<Edit>({ step: "view" });
  const { account, status: wallets, connectError, connect, disconnect, wallet: connectedWallet } = useNearWallet();

  const load = useCallback(async () => {
    setReadError(false);
    try {
      const c = await getConfig(walletId);
      setConfig(c);
      const entries = await Promise.all(c.receivers.map(async (r) => [r, await getToken(r, walletId)] as const));
      setTokens(Object.fromEntries(entries));
      if (!c.mandate_hash) return setText({ state: "none" });
      const res = await fetch(`/api/mandates/${c.mandate_hash}`).catch(() => null);
      const body = res?.ok ? await res.json().catch(() => null) : null;
      if (typeof body?.text !== "string") return setText({ state: "unavailable" });
      setText((await sha256Hex(body.text)) === c.mandate_hash ? { state: "live", text: body.text } : { state: "mismatch" });
    } catch {
      setReadError(true);
    }
  }, [walletId]);

  useEffect(() => {
    // Reading from the chain on mount is a sync with an external system; the setState calls happen after awaits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const isOwner = !!account && account === config?.owner_id;
  const current = text.state === "live" ? text.text : "";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5 pt-10 pb-7">
        <div>
          <h1 className="text-[clamp(34px,4.4vw,60px)] leading-none font-black tracking-[-0.035em]">The rules your agent pays by.</h1>
          <p className="mt-3 text-sm text-mute">
            Wallet{" "}
            <a href={nearblocksAccount(walletId)} className="font-mono break-all text-text hover:underline">
              {walletId}
            </a>
            {config && (
              <>
                {" "}· owner <span className="font-mono text-text">{config.owner_id}</span>
              </>
            )}
          </p>
        </div>
        {account ? (
          <span className="inline-flex items-center gap-2.5 text-sm text-mute">
            <span className="size-2 rounded-full bg-lime" aria-hidden="true" />
            <span className="font-mono text-[13px] text-text">{account}</span>
            <button onClick={disconnect} className="underline underline-offset-[3px] hover:text-text">
              Sign out
            </button>
          </span>
        ) : (
          <div className="text-right">
            <button onClick={connect} disabled={wallets !== "ready"} className={secondary}>
              {wallets === "loading" && <Spinner />}
              Connect wallet
            </button>
            {wallets === "failed" && <p className="mt-2 text-xs text-coral">The wallet list didn&apos;t load. Reload to try again.</p>}
            {connectError && <p className="mt-2 max-w-[28em] text-xs text-coral">{connectError}</p>}
          </div>
        )}
      </div>

      {readError && (
        <div className="mb-6 rounded-[18px] border border-line bg-ink-2 p-5 text-sm text-mute">
          Couldn&apos;t read the wallet from NEAR {NETWORK}.{" "}
          <button onClick={load} className="font-bold text-text underline underline-offset-[3px]">
            Try again
          </button>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-7 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section className="rounded-[22px] border border-line bg-ink-2 p-[clamp(20px,2.4vw,32px)]" aria-label="The rules">
          {edit.step === "edit" && account ? (
            <RulesEditor
              walletId={walletId}
              current={current}
              signerId={account}
              wallet={connectedWallet}
              onDone={(tx) => {
                setEdit({ step: "done", tx });
                load();
              }}
              onError={(message) => setEdit({ step: "error", message })}
              onCancel={() => setEdit({ step: "view" })}
            />
          ) : (
            <>
              <LiveLabel text={text} />
              {/* overflow-wrap: anywhere, so a 42-character 0x address in the rules breaks instead of running off a phone screen. */}
              {text.state === "live" && (
                <p className="text-[clamp(24px,2.4vw,34px)] leading-tight font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">{text.text}</p>
              )}
              {text.state === "unavailable" && (
                <p className="text-lg text-mute">The text of these rules isn&apos;t available from the API right now. The hash below is what the wallet enforces.</p>
              )}
              {text.state === "mismatch" && (
                <p className="text-lg text-mute">The API returned a text whose hash isn&apos;t the wallet&apos;s, so it isn&apos;t shown.</p>
              )}
              {text.state === "none" && <p className="text-lg text-mute">No rules are set on this wallet, so every payment is refused.</p>}
              {text.state === "loading" && (
                <Loading label="Reading the wallet">
                  <Skeleton className="h-[clamp(26px,2.6vw,36px)] w-full" />
                  <Skeleton className="mt-3 h-[clamp(26px,2.6vw,36px)] w-4/5" />
                  <Skeleton className="mt-3 h-[clamp(26px,2.6vw,36px)] w-1/2" />
                </Loading>
              )}

              {config?.mandate_hash && (
                <dl className="mt-6 grid gap-2.5 border-t border-line pt-5 text-[13px]">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 sm:grid-cols-[190px_minmax(0,1fr)_auto]">
                    <dt className="text-mute max-sm:col-span-2">mandate_hash on the wallet</dt>
                    <dd className="truncate font-mono text-xs">{config.mandate_hash}</dd>
                    <dd className={text.state === "live" ? "text-lime" : "text-mute"}>{text.state === "live" ? "matches the text" : ""}</dd>
                  </div>
                </dl>
              )}
              {text.state === "live" && (
                <p className="mt-4 max-w-[52em] text-[13px] text-mute">
                  The wallet stores only this hash. Your browser read it from the contract and hashed the text itself. A verdict signed
                  under any other text is refused on-chain.
                </p>
              )}

              {edit.step === "done" && (
                <p className="mt-5 flex items-center gap-2 text-sm">
                  <Check className="size-4 text-lime" /> Rules set on the wallet ·{" "}
                  <a href={nearblocksTx(edit.tx)} className="font-mono text-soft hover:underline">
                    {short(edit.tx)}
                  </a>
                </p>
              )}
              {edit.step === "error" && (
                <p className="mt-5 flex items-start gap-2 text-sm text-coral">
                  <Cross className="mt-1 size-3.5 shrink-0" /> {edit.message}
                </p>
              )}

              {isOwner && (
                <div className="mt-6">
                  <button
                    onClick={() => setEdit({ step: "edit" })}
                    className={primary}
                  >
                    Edit the rules
                  </button>
                </div>
              )}
              {account && config && !isOwner && (
                <p className="mt-5 text-[13px] text-mute">
                  You&apos;re signed in as <span className="font-mono text-text">{account}</span>. Only the owner,{" "}
                  <span className="font-mono text-text">{config.owner_id}</span>, can change these rules.
                </p>
              )}
            </>
          )}
        </section>

        <aside className="rounded-[22px] border border-line bg-ink-2 p-[clamp(20px,2.4vw,28px)]">
          <h2 className="text-xl leading-tight font-black tracking-[-0.01em]">What the contract enforces, whatever the model says</h2>
          <p className="mt-1.5 text-[13px] text-mute">Read from the contract just now. These are the backstop; the rules can only be stricter.</p>
          {config ? (
            <dl className="mt-4 text-sm">
              {config.receivers.flatMap((r) => {
                const t = tokens[r];
                if (!t) return [];
                return [
                  <Limit key={`${r}-tx`} label={`${t.symbol} per payment`} value={formatUnits(t.caps.per_tx, t.decimals)} />,
                  <Limit key={`${r}-day`} label={`${t.symbol} per day (UTC)`} value={formatUnits(t.caps.daily, t.decimals)} />,
                ];
              })}
              <Limit label="NEAR it can attach" value={`${nearAmount(config.near_caps.per_tx)} per call`} />
              <Limit label="Contracts it can call" value={config.receivers.join(", ") || "none"} mono />
              <Limit
                label="Verdict signer"
                value={
                  <a href={`${REPO}/tree/main/docs/attestations`} className="inline-flex items-center gap-1 hover:underline">
                    {config.signers.map((s) => short(s, 6, 4)).join(", ")} · attestation <ArrowUpRight className="size-3" />
                  </a>
                }
                mono
              />
              <Limit label="Model" value={config.model_id} mono />
              <Limit label="Frozen" value={config.frozen ? "Yes: nothing executes" : "No"} />
            </dl>
          ) : (
            !readError && (
              <Loading label="Reading the contract">
                <div className="mt-4 grid gap-4">
                  {["w-full", "w-11/12", "w-full", "w-4/5", "w-full", "w-3/5", "w-2/3"].map((w, i) => (
                    <Skeleton key={i} className={`h-3.5 ${w}`} />
                  ))}
                </div>
              </Loading>
            )
          )}
        </aside>
      </div>
    </>
  );
}

function LiveLabel({ text }: { text: Text }) {
  if (text.state === "live")
    return (
      <p className="mb-4 flex items-center gap-2 text-xs font-black tracking-[0.12em] text-lime uppercase">
        <Check className="size-3.5" /> Live on the wallet
      </p>
    );
  if (text.state === "mismatch")
    return (
      <p className="mb-4 flex items-center gap-2 text-xs font-black tracking-[0.12em] text-coral uppercase">
        <Cross className="size-3.5" /> Text doesn&apos;t match the wallet
      </p>
    );
  return null;
}

function Limit({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3.5 border-t border-line py-3">
      <dt className="text-mute">{label}</dt>
      <dd className={`text-right font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
