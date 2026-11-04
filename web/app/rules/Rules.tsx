"use client";

import type { NearConnector } from "@hot-labs/near-connect";
import { useCallback, useEffect, useRef, useState } from "react";
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
  type WalletConfig,
  type WalletToken,
} from "../lib/near";

const MAX_CHARS = 2000; // POST /api/mandate's limit
const SET_MANDATE_GAS = "30000000000000";

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

type Edit =
  | { step: "view" }
  | { step: "edit" }
  | { step: "saving" }
  | { step: "signing"; hash: string }
  | { step: "done"; tx: string }
  | { step: "error"; message: string };

const short = (s: string, head = 8, tail = 8) => (s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s);

/** NEAR deposits are yoctoNEAR; the wallet's caps are tiny, so show them as written. */
const nearAmount = (raw: string) => (raw.length <= 6 ? `${raw} yoctoNEAR` : `${formatUnits(raw, 24)} NEAR`);

export function Rules() {
  const [config, setConfig] = useState<WalletConfig | null>(null);
  const [tokens, setTokens] = useState<Record<string, WalletToken | null>>({});
  const [readError, setReadError] = useState(false);
  const [text, setText] = useState<Text>({ state: "loading" });
  const [account, setAccount] = useState<string | null>(null);
  const [edit, setEdit] = useState<Edit>({ step: "view" });
  const [draft, setDraft] = useState("");
  const connector = useRef<NearConnector | null>(null);
  // The button is live only once the connector exists, and a failed connect says so instead of doing nothing.
  const [wallets, setWallets] = useState<"loading" | "ready" | "failed">("loading");
  const [connectError, setConnectError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setReadError(false);
    try {
      const c = await getConfig();
      setConfig(c);
      const entries = await Promise.all(c.receivers.map(async (r) => [r, await getToken(r)] as const));
      setTokens(Object.fromEntries(entries));
      if (!c.mandate_hash) return setText({ state: "none" });
      const res = await fetch(`/api/mandates/${c.mandate_hash}`).catch(() => null);
      const body = res?.ok ? await res.json().catch(() => null) : null;
      if (typeof body?.text !== "string") return setText({ state: "unavailable" });
      setText((await sha256Hex(body.text)) === c.mandate_hash ? { state: "live", text: body.text } : { state: "mismatch" });
    } catch {
      setReadError(true);
    }
  }, []);

  useEffect(() => {
    // Reading from the chain on mount is a sync with an external system; the setState calls happen after awaits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // The wallet connector loads only here, and restores a previous sign-in.
  useEffect(() => {
    let cancelled = false;
    import("@hot-labs/near-connect")
      .then(async ({ NearConnector }) => {
        if (cancelled) return;
        const c = new NearConnector({ network: NETWORK });
        connector.current = c;
        c.on("wallet:signIn", (e) => setAccount(e.accounts[0]?.accountId ?? null));
        c.on("wallet:signOut", () => setAccount(null));
        const signedIn = await c.getConnectedWallet().catch(() => null);
        if (cancelled) return;
        setAccount(signedIn?.accounts[0]?.accountId ?? null);
        setWallets("ready");
      })
      .catch(() => !cancelled && setWallets("failed"));
    return () => {
      cancelled = true;
      connector.current?.removeAllListeners();
      connector.current = null;
    };
  }, []);

  async function connect() {
    if (!connector.current) return;
    setConnectError(null);
    try {
      await connector.current.connect();
    } catch (e) {
      // Closing the picker rejects too; only a real failure is worth showing.
      const message = e instanceof Error ? e.message : String(e);
      if (!/reject|cancel|clos/i.test(message)) setConnectError(message || "The wallet didn't connect");
    }
  }

  const isOwner = !!account && account === config?.owner_id;
  const current = text.state === "live" ? text.text : "";

  async function save() {
    if (!connector.current || !account) return;
    setEdit({ step: "saving" });
    try {
      const res = await fetch("/api/mandate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `The API answered ${res.status}`);
      // Never ask the owner to sign a hash we didn't compute ourselves.
      const hash = await sha256Hex(draft);
      if (body?.text_hash !== hash) throw new Error("The API's hash for this text doesn't match the one computed here; nothing was signed");
      setEdit({ step: "signing", hash });
      const wallet = await connector.current.wallet();
      const outcome = await wallet.signAndSendTransaction({
        signerId: account,
        receiverId: WALLET_ID,
        actions: [{ type: "FunctionCall", params: { methodName: "set_mandate", args: { text_hash: hash }, gas: SET_MANDATE_GAS, deposit: "0" } }],
      });
      setEdit({ step: "done", tx: outcome.transaction.hash });
      await load();
    } catch (e) {
      setEdit({ step: "error", message: e instanceof Error ? e.message : "The wallet didn't sign" });
    }
  }

  const editing = edit.step === "edit" || edit.step === "saving" || edit.step === "signing";
  const draftHashMatchesCurrent = draft === current;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5 pt-10 pb-7">
        <div>
          <h1 className="text-[clamp(34px,4.4vw,60px)] leading-none font-black tracking-[-0.035em]">The rules your agent pays by.</h1>
          <p className="mt-3 text-sm text-mute">
            Wallet <a href={nearblocksAccount(WALLET_ID)} className="font-mono text-text hover:underline">{WALLET_ID}</a>
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
            <button onClick={() => connector.current?.disconnect()} className="underline underline-offset-[3px] hover:text-text">
              Sign out
            </button>
          </span>
        ) : (
          <div className="text-right">
            <button onClick={connect} disabled={wallets !== "ready"} className={secondary}>
              {wallets === "loading" ? "Loading wallets…" : "Connect wallet"}
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
          {editing ? (
            <>
              <label htmlFor="rules-draft" className="mb-2 block text-xs text-mute">
                Write the rules in plain English
              </label>
              <textarea
                id="rules-draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_CHARS}
                disabled={edit.step !== "edit"}
                className="min-h-[150px] w-full resize-y rounded-2xl border-[1.5px] border-line bg-ink p-[18px] text-xl leading-snug font-medium text-text outline-none focus:border-soft disabled:opacity-70"
              />
              <div className="mt-2 flex justify-between gap-4 text-xs text-mute">
                <span>Saved exactly as typed; spaces and line breaks count.</span>
                <span className="font-mono">
                  {draft.length} / {MAX_CHARS}
                </span>
              </div>
              <p className="mt-4 rounded-[14px] border border-line bg-ink px-4 py-3.5 text-[13px] text-mute">
                <b className="font-bold text-text">The agent switches to these rules on its next payment.</b> The contract&apos;s
                limits still apply: rules can only tighten them, never loosen them.
              </p>
              {edit.step === "edit" ? (
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <button onClick={save} disabled={!draft || draftHashMatchesCurrent} className={primary}>
                    Save and sign
                  </button>
                  <button onClick={() => setEdit({ step: "view" })} className={secondary}>
                    Cancel
                  </button>
                </div>
              ) : (
                <ol className="mt-6 grid gap-2.5 text-sm">
                  <Step n={1} state={edit.step === "saving" ? "now" : "done"} title="Save the text" />
                  <Step
                    n={2}
                    state={edit.step === "signing" ? "now" : "todo"}
                    title="Approve set_mandate in your wallet"
                    note={edit.step === "signing" ? `sha256 ${short(edit.hash)} · waiting for your wallet` : undefined}
                  />
                  <Step n={3} state="todo" title="Confirmed on-chain" />
                </ol>
              )}
            </>
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
              {text.state === "loading" && <p className="text-lg text-mute">Reading the wallet…</p>}

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
                    onClick={() => {
                      setDraft(current);
                      setEdit({ step: "edit" });
                    }}
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
            !readError && <p className="mt-4 text-sm text-mute">Reading the contract…</p>
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

function Step({ n, state, title, note }: { n: number; state: "done" | "now" | "todo"; title: string; note?: string }) {
  const badge = { done: "bg-lime text-lime-ink", now: "bg-soft text-ink", todo: "bg-line text-mute" }[state];
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3">
      <span className={`grid size-7 place-items-center rounded-[9px] font-mono text-xs ${badge}`} aria-hidden="true">
        {state === "done" ? <Check className="size-3.5" /> : n}
      </span>
      <span>
        {title}
        {note && <small className="block font-mono text-xs text-mute">{note}</small>}
      </span>
    </li>
  );
}
