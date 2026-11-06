"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Cross } from "../../components/icons";
import { InitCommand } from "../../components/InitCommand";
import { REPO } from "../../components/SiteHeader";
import { Loading, Skeleton, Spinner } from "../../components/Skeleton";
import {
  decimalInput,
  FACTORY_ID,
  formatUnits,
  getConfig,
  LABEL,
  nearblocksAccount,
  nearblocksTx,
  parseUnits,
  sha256Hex,
  TOKENS,
  type Token,
  viewAccount,
  viewOn,
  type WalletConfig,
} from "../../lib/near";
import { rememberWallet, walletHref } from "../../lib/myWallets";
import { useNearWallet } from "../../lib/useNearWallet";
import { call, ED25519_KEY, fundActions } from "../../lib/walletActions";

const MAX_RULES = 2000; // POST /api/mandate's limit
const CREATE_GAS = "300000000000000"; // 300 Tgas
// Create renders only on a build with a factory (testnet): the mainnet build shows a note instead (create/page.tsx).
const FACTORY = FACTORY_ID ?? "";
// The NEAR the wallet may attach to a call: ft_transfer's 1 yocto security deposit. Fixed, as in Furqaan's example.
const NEAR_CAPS = { per_tx: "1", daily: "100" };


const button = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const primary = `${button} bg-lime text-lime-ink`;
const secondary = `${button} border-[1.5px] border-line bg-ink-2 text-text hover:border-soft`;
const field = "flex items-center overflow-hidden rounded-[14px] border-[1.5px] border-line bg-ink-2 focus-within:border-soft";
const input = "min-w-0 flex-1 bg-transparent px-3.5 py-3 outline-none";
const suffix = "px-3.5 font-mono text-sm whitespace-nowrap text-mute";

type Judge = { signer: string; prompt_hash: string; model_id: string };
type NameStatus = "invalid" | "checking" | "free" | "taken" | "error";
type Flow =
  | { step: "form" }
  | { step: "saving" }
  | { step: "signing" }
  | { step: "confirming" }
  | { step: "error"; message: string }
  | { step: "created"; walletId: string; tx: string; mandateHash: string; agentKey: string | null };

/** The form, kept for this tab while it's being filled in, so a wallet that signs in on another page loses nothing. */
const DRAFT_KEY = "intented:create-draft";
type Draft = { name: string; rules: string; tokenIndex: number; perTx: string; daily: string; agentKey: string; allowance: string };
function readDraft(): Partial<Draft> {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "{}") as Partial<Draft>;
  } catch {
    return {};
  }
}
function writeDraft(d: Draft | null) {
  try {
    if (d) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {}
}

const shortKey = (s: string) => (s.length > 22 ? `${s.slice(0, 14)}…${s.slice(-6)}` : s);
const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function CreateWallet() {
  const near = useNearWallet();
  const [judge, setJudge] = useState<Judge | null>(null);
  const [factory, setFactory] = useState<{ minDeposit: string; codeHash: string } | null>(null);
  const [loadError, setLoadError] = useState(false);

  // A link from the agent's machine (intented init) can fill in the name and the agent's public key; anything malformed is ignored.
  const params = useSearchParams();
  const [linkKey] = useState(() => {
    const k = params.get("key")?.trim() ?? "";
    return ED25519_KEY.test(k) ? k : "";
  });
  const [name, setName] = useState(() => params.get("name")?.toLowerCase().slice(0, 64 - FACTORY.length - 1) ?? "");
  const [nameStatus, setNameStatus] = useState<NameStatus>("invalid");
  const [rules, setRules] = useState("");
  const [tokenIndex, setTokenIndex] = useState(0);
  const [perTx, setPerTx] = useState("0.01");
  const [daily, setDaily] = useState("0.05");
  const [agentKey, setAgentKey] = useState(linkKey);
  const [allowance, setAllowance] = useState("0.5");
  const [rulesHash, setRulesHash] = useState("");
  const [flow, setFlow] = useState<Flow>({ step: "form" });

  const token = TOKENS[tokenIndex];
  const walletId = `${name}.${FACTORY}`;

  // Restores this tab's draft once, after the first render (sessionStorage isn't there on the server). A link from
  // intented init keeps its own name and key. Declared before the effect that saves, so the saved draft is read first.
  useEffect(() => {
    const d = readDraft();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!params.get("name") && typeof d.name === "string") setName(d.name);
    if (!linkKey && typeof d.agentKey === "string") setAgentKey(d.agentKey);
    if (typeof d.rules === "string") setRules(d.rules);
    if (typeof d.tokenIndex === "number" && TOKENS[d.tokenIndex]) setTokenIndex(d.tokenIndex);
    if (typeof d.perTx === "string") setPerTx(d.perTx);
    if (typeof d.daily === "string") setDaily(d.daily);
    if (typeof d.allowance === "string") setAllowance(d.allowance);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (flow.step !== "created") writeDraft({ name, rules, tokenIndex, perTx, daily, agentKey, allowance });
  }, [name, rules, tokenIndex, perTx, daily, agentKey, allowance, flow.step]);

  // The judge comes from our live wallet, so a new wallet trusts the same attested signer, prompt and model.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getConfig(), viewOn<string>(FACTORY, "get_min_deposit", {}), viewOn<string>(FACTORY, "get_code_hash", {})])
      .then(([c, minDeposit, codeHash]: [WalletConfig, string, string]) => {
        if (cancelled) return;
        if (!c.signers[0] || !c.prompt_hash) throw new Error("no signer or prompt");
        setJudge({ signer: c.signers[0], prompt_hash: c.prompt_hash, model_id: c.model_id });
        setFactory({ minDeposit, codeHash });
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Is the name free? Checked against the chain a moment after typing stops.
  useEffect(() => {
    if (!LABEL.test(name) || walletId.length > 64) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNameStatus("invalid");
      return;
    }
    setNameStatus("checking");
    let cancelled = false;
    const t = setTimeout(() => {
      viewAccount(walletId)
        .then((a) => !cancelled && setNameStatus(a ? "taken" : "free"))
        .catch(() => !cancelled && setNameStatus("error"));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [name, walletId]);

  useEffect(() => {
    let cancelled = false;
    sha256Hex(rules).then((h) => !cancelled && setRulesHash(h));
    return () => {
      cancelled = true;
    };
  }, [rules]);

  const perTxRaw = parseUnits(perTx, token.decimals);
  const dailyRaw = parseUnits(daily, token.decimals);
  const capsError =
    !perTxRaw || !dailyRaw || perTxRaw === "0"
      ? `Amounts in ${token.symbol}, with at most ${token.decimals} decimal places, above zero`
      : BigInt(dailyRaw) < BigInt(perTxRaw)
        ? "The daily limit must be at least the per-payment limit"
        : null;
  const key = agentKey.trim();
  const keyError = key && !ED25519_KEY.test(key) ? "An ed25519 public key: ed25519: then 43 or 44 base58 characters" : null;
  const allowanceRaw = parseUnits(allowance, 24);
  const allowanceError = key && (!allowanceRaw || allowanceRaw === "0") ? "A NEAR amount above zero" : null;
  const rulesTrimmed = rules.trim();

  const ready =
    !!near.account && !!judge && !!factory && nameStatus === "free" && !!rulesTrimmed && rules.length <= MAX_RULES && !capsError && !keyError && !allowanceError;
  // What still stands between the owner and "Create wallet", in the form's own order.
  const missing = [
    !judge || !factory ? "Reading the factory and the judge from NEAR testnet…" : null,
    nameStatus === "invalid" ? (name ? "Name it: lowercase letters and digits, with single - or _ between them" : "Name it: choose a name") : null,
    nameStatus === "checking" ? "Name it: checking the name is free…" : null,
    nameStatus === "taken" ? `Name it: ${walletId} is taken` : null,
    nameStatus === "error" ? "Name it: couldn't check the name; edit it to try again" : null,
    !rulesTrimmed ? "Write the rules" : rules.length > MAX_RULES ? `Write the rules: at most ${MAX_RULES} characters` : null,
    capsError ? `Hard limits: ${capsError}` : null,
    keyError ? `Agent key: ${keyError}` : null,
    allowanceError ? `Agent's gas: ${allowanceError}` : null,
  ].filter((m): m is string => !!m);

  const createArgs = useMemo(
    () =>
      judge && perTxRaw && dailyRaw
        ? {
            name,
            model_id: judge.model_id,
            setup: {
              signer: judge.signer,
              prompt_hash: judge.prompt_hash,
              mandate_hash: rulesHash,
              token_id: token.contract,
              token: { symbol: token.symbol, decimals: token.decimals, caps: { per_tx: perTxRaw, daily: dailyRaw } },
              near_caps: NEAR_CAPS,
            },
            ...(key ? { agent_key: key, agent_allowance: allowanceRaw } : {}),
          }
        : null,
    [judge, perTxRaw, dailyRaw, name, rulesHash, token, key, allowanceRaw],
  );

  async function create() {
    if (!ready || !createArgs || !factory || !near.account) return;
    setFlow({ step: "saving" });
    try {
      // The API keeps the rules' text so it can judge against it; the wallet stores only the hash.
      const res = await fetch("/api/mandate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: rules }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Saving the rules failed: the API answered ${res.status}. Nothing was signed.`);
      // Never ask the owner to sign a hash we didn't compute ourselves.
      const hash = await sha256Hex(rules);
      if (body?.text_hash !== hash || createArgs.setup.mandate_hash !== hash) {
        throw new Error("The API's hash for the rules doesn't match the one computed here. Nothing was signed.");
      }

      setFlow({ step: "signing" });
      const wallet = await near.wallet();
      const outcome = await wallet.signAndSendTransaction({
        signerId: near.account,
        receiverId: FACTORY,
        actions: [{ type: "FunctionCall", params: { methodName: "create", args: createArgs, gas: CREATE_GAS, deposit: factory.minDeposit } }],
      });

      // The chain is the judge of success: the account exists and runs the factory's code.
      setFlow({ step: "confirming" });
      let made = null;
      for (let i = 0; i < 10 && !made; i++) {
        made = await viewAccount(walletId).catch(() => null);
        if (!made) await new Promise((r) => setTimeout(r, 1500));
      }
      if (!made) throw new Error(`The transaction went through, but ${walletId} wasn't created; the factory refunds the deposit. Transaction ${outcome.transaction.hash}.`);
      rememberWallet(walletId);
      writeDraft(null);
      setFlow({ step: "created", walletId, tx: outcome.transaction.hash, mandateHash: hash, agentKey: key || null });
    } catch (e) {
      setFlow({ step: "error", message: errorText(e, "The wallet didn't sign") });
    }
  }

  if (flow.step === "created") return <Created flow={flow} near={near} factory={factory} judge={judge} token={token} />;

  const busy = flow.step === "saving" || flow.step === "signing" || flow.step === "confirming";

  return (
    <>
      <Intro />

      {/* First, not last: the owner signs at the end, and a phone would otherwise find this 2,000px down. */}
      {!near.account && near.status !== "loading" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[18px] border border-line bg-ink-2 p-5">
          <p className="max-w-[42em] text-sm text-mute">
            <b className="font-bold text-text">Connect your NEAR testnet wallet first.</b> It becomes this wallet&apos;s owner and approves one call at the
            end. What you fill in here is kept in this tab while you sign in.
          </p>
          <button onClick={near.connect} disabled={near.status !== "ready"} className={secondary}>
            Connect your NEAR wallet
          </button>
        </div>
      )}

      {loadError && (
        <p className="mt-6 rounded-[18px] border border-line bg-ink-2 p-5 text-sm text-mute">
          Couldn&apos;t read the factory or the judge from NEAR testnet. Reload to try again.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 pt-7 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <form onSubmit={(e) => e.preventDefault()} className="min-w-0">
          <Section n={1} title="Name it" note={`Your wallet gets its own NEAR account under ${FACTORY}.`} first>
            <label htmlFor="cw-name" className="text-sm font-bold">
              Wallet name
            </label>
            <div className={`${field} mt-2`}>
              <input
                id="cw-name"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase())}
                placeholder="my-shop"
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                className={`${input} font-mono text-sm`}
              />
              <span className={suffix}>.{FACTORY}</span>
            </div>
            <p className={`mt-2 text-[13px] ${nameStatus === "free" ? "text-soft" : nameStatus === "taken" ? "text-coral" : "text-mute"}`} aria-live="polite">
              {!name
                ? "Lowercase letters and digits, with - or _ between them."
                : nameStatus === "invalid"
                  ? "Lowercase letters and digits, with single - or _ between them; no dots."
                  : nameStatus === "checking"
                    ? "Checking…"
                    : nameStatus === "free"
                      ? `${walletId} is free`
                      : nameStatus === "taken"
                        ? `${walletId} is taken`
                        : "Couldn't check the name. Try again in a moment."}
            </p>
          </Section>

          <Section n={2} title="Write the rules" note="In plain English: who the agent may pay, in what, and how much. The AI judges every payment against this text.">
            <textarea
              aria-label="The rules"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              maxLength={MAX_RULES}
              disabled={busy}
              placeholder={`Buy market data from vendor.testnet only, paid in ${token.symbol}, at most ${perTx || "0.01"} ${token.symbol} per call.`}
              className="min-h-[130px] w-full resize-y rounded-[14px] border-[1.5px] border-line bg-ink-2 p-4 text-[17px] leading-snug outline-none focus:border-soft"
            />
            <div className="mt-2 flex justify-between gap-4 text-[13px] text-mute">
              <span>Only its sha256 goes on-chain. The text is kept by Intented&apos;s API, which judges against it, and is public.</span>
              <span className="font-mono">
                {rules.length}/{MAX_RULES}
              </span>
            </div>
          </Section>

          <Section n={3} title="Set the hard limits" note="The contract enforces these whatever the AI says. Your rules can only be stricter.">
            <p className="text-sm font-bold">Token the agent pays in</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Token">
              {TOKENS.map((t, i) => (
                <button
                  key={t.contract}
                  type="button"
                  role="radio"
                  aria-checked={i === tokenIndex}
                  disabled={busy}
                  onClick={() => setTokenIndex(i)}
                  className={`rounded-full border-[1.5px] bg-ink-2 px-3.5 py-1.5 text-sm font-bold ${i === tokenIndex ? "border-soft text-text" : "border-line text-mute"}`}
                >
                  {t.symbol}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <Amount id="cw-ptx" label="At most per payment" value={perTx} onChange={setPerTx} unit={token.symbol} decimals={token.decimals} disabled={busy} />
              <Amount id="cw-day" label="At most per day (UTC)" value={daily} onChange={setDaily} unit={token.symbol} decimals={token.decimals} disabled={busy} />
            </div>
            {capsError && <p className="mt-2 text-[13px] text-coral">{capsError}</p>}
          </Section>

          <Section n={4} title="Connect your agent" note="Optional now; you can add it later. It becomes a key on the wallet that can only propose and execute payments, never move money on its own.">
            <label htmlFor="cw-key" className="text-sm font-bold">
              Agent public key
            </label>
            <div className={`${field} mt-2`}>
              <input
                id="cw-key"
                value={agentKey}
                onChange={(e) => setAgentKey(e.target.value)}
                placeholder="ed25519:…"
                spellCheck={false}
                autoComplete="off"
                disabled={busy}
                className={`${input} font-mono text-sm`}
              />
            </div>
            <p className={`mt-2 text-[13px] ${keyError ? "text-coral" : "text-mute"}`}>
              {keyError ?? "Only the public key. Generate the key pair where your agent runs; Intented never sees the private key."}
            </p>
            {!agentKey && <InitCommand name={name} then="prints a link back to this page with the key filled in." />}
            {/* A link can carry anyone's key, and this key will be able to propose and execute on the wallet. */}
            {linkKey && key === linkKey && (
              <p className="mt-2 rounded-[12px] border border-line bg-ink px-3.5 py-2.5 text-[13px] text-mute">
                <b className="font-bold text-text">Filled in from the link you opened.</b> Use it only if it&apos;s the key your own agent printed: whoever
                holds its private key can propose and execute payments on this wallet, within your rules and limits.
              </p>
            )}
            {key && (
              <div className="mt-4 max-w-[260px]">
                <Amount id="cw-allow" label="Gas allowance" value={allowance} onChange={setAllowance} unit="NEAR" decimals={24} disabled={busy} />
                <p className={`mt-2 text-[13px] ${allowanceError ? "text-coral" : "text-mute"}`}>
                  {allowanceError ??
                    (Number(allowance) > 0.5
                      ? "The most the agent's transactions may spend on gas. The wallet starts with about 0.5 NEAR for it; you can send more when you add a key."
                      : "The most the agent's transactions may spend on gas. The deposit leaves about 0.5 NEAR for it.")}
                </p>
              </div>
            )}
          </Section>

          <Section n={5} title="The judge" note="Prefilled with the signer Intented's own wallet trusts. Its attestation report was verified before it was allowlisted.">
            {judge ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-ink-2 p-3.5">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-medium text-soft">Attestation verified off-chain · Intel TDX + NVIDIA</p>
                  <p className="mt-1 font-mono text-[13px] break-all text-soft">
                    {judge.model_id} · signer {judge.signer}
                  </p>
                </div>
                <a href={`${REPO}/blob/main/docs/attestations/${judge.signer}.json`} className="inline-flex items-center gap-1 text-[13px] text-text underline decoration-line underline-offset-[3px] hover:decoration-soft">
                  Attestation report <ArrowUpRight className="size-3.5" />
                </a>
              </div>
            ) : (
              <Loading label="Reading the judge from NEAR testnet">
                <div className="rounded-[14px] border border-line bg-ink-2 p-3.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="mt-2.5 h-3.5 w-11/12" />
                </div>
              </Loading>
            )}
            {factory && (
              <p className="mt-3 text-[13px] text-mute">
                Every wallet from this factory runs code hash <span className="font-mono break-all text-soft">{factory.codeHash}</span>, which{" "}
                <span className="font-mono">{FACTORY} · get_code_hash()</span> returns and the new account will show.
              </p>
            )}
          </Section>

          <p className="mt-2 rounded-[14px] border border-line bg-ink px-4 py-3.5 text-[13.5px] text-mute">
            <b className="font-bold text-text">The wallet has no full-access key and can&apos;t be upgraded.</b> Nobody, you included, can change its
            contract. You can always withdraw; if a bug is ever found, you withdraw and create a new wallet.
          </p>
        </form>

        <aside className="rounded-[24px] bg-card p-[clamp(20px,2.4vw,28px)] lg:sticky lg:top-24" aria-label="What you'll sign">
          <p className="font-mono text-[11px] font-medium tracking-[0.1em] text-mute uppercase">What you&apos;ll sign</p>
          <p className="mt-2.5 font-mono text-lg font-medium break-all">{name ? walletId : `….${FACTORY}`}</p>
          <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm [&_dd]:text-right [&_dd]:font-mono [&_dd]:text-[13px] [&_dd]:break-all [&_dt]:text-mute">
            <dt>Owner</dt>
            <dd>{near.account ?? "your NEAR account"}</dd>
            <dt>Pays in</dt>
            <dd>
              {token.symbol} · {token.contract.length > 20 ? `${token.contract.slice(0, 8)}…` : token.contract}
            </dd>
            <dt>Per payment</dt>
            <dd>{perTxRaw ? `${perTx} ${token.symbol}` : "—"}</dd>
            <dt>Per day</dt>
            <dd>{dailyRaw ? `${daily} ${token.symbol}` : "—"}</dd>
            <dt>Agent key</dt>
            <dd>{key && !keyError ? shortKey(key) : "none yet"}</dd>
            <dt>Rules hash</dt>
            <dd>{rulesTrimmed ? `${rulesHash.slice(0, 12)}…` : "—"}</dd>
            <dt>Judge</dt>
            <dd>{judge ? `${judge.signer.slice(0, 6)}…${judge.signer.slice(-4)}` : <Skeleton className="ml-auto h-3.5 w-24" />}</dd>
          </dl>
          {rulesTrimmed && <p className="mt-4 max-h-36 overflow-auto rounded-[14px] bg-ink-2 p-3.5 text-sm break-words text-soft">{rules}</p>}
          <div className="mt-5 flex items-baseline justify-between border-t border-dashed border-line pt-4">
            <span className="text-mute">Deposit</span>
            {factory ? (
              <b className="text-[28px] font-black tracking-[-0.02em]">{`${Number(formatUnits(factory.minDeposit, 24)).toFixed(2)} NEAR`}</b>
            ) : (
              <Skeleton className="h-8 w-28" />
            )}
          </div>
          <p className="mt-2 text-[12.5px] text-mute">It stays in the wallet: most of it is locked for the contract&apos;s storage, and about 0.5 NEAR is left for your agent&apos;s gas. If
            creating fails, it&apos;s refunded.</p>

          {near.account ? (
            <button onClick={create} disabled={!ready || busy} className={`${primary} mt-5 w-full py-4`}>
              {flow.step === "saving" ? "Saving the rules…" : flow.step === "signing" ? "Approve in your wallet…" : flow.step === "confirming" ? "Creating…" : "Create wallet"}
            </button>
          ) : (
            <button onClick={near.connect} disabled={near.status !== "ready"} className={`${primary} mt-5 w-full py-4`}>
              {near.status === "loading" && <Spinner tone="dark" />}
              Connect your NEAR wallet
            </button>
          )}
          {near.status === "failed" && <p className="mt-2 text-xs text-coral">The wallet list didn&apos;t load. Reload to try again.</p>}
          {near.connectError && <p className="mt-2 text-xs text-coral">{near.connectError}</p>}
          {near.account && !ready && !busy && missing.length > 0 && (
            <div className="mt-3 text-[13px] text-mute" aria-live="polite">
              <p>Before you can create it:</p>
              <ul className="mt-1 grid list-disc gap-0.5 pl-5">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {flow.step === "error" && <p className="mt-3 text-[13px] break-words text-coral">{flow.message}</p>}
          <p className="mt-3 text-[12.5px] text-mute">
            Your wallet asks you to approve one call: <span className="font-mono">{FACTORY} · create</span>, 300 Tgas.
            {near.account && (
              <>
                {" "}
                Signed in as <span className="font-mono text-text">{near.account}</span>.
              </>
            )}
          </p>
        </aside>
      </div>
    </>
  );
}

function Section({ n, title, note, first, children }: { n: number; title: string; note: string; first?: boolean; children: React.ReactNode }) {
  return (
    <section className={first ? "pb-6" : "border-t border-line py-6"}>
      <div className="mb-4 flex items-start gap-3.5">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[9px] bg-card font-mono text-[13px] text-text" aria-hidden="true">
          {n}
        </span>
        <div>
          <h2 className="text-[22px] leading-tight font-black tracking-[-0.015em]">{title}</h2>
          <p className="mt-1 text-sm text-mute">{note}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Amount({ id, label, value, onChange, unit, decimals, disabled }: { id: string; label: string; value: string; onChange: (v: string) => void; unit: string; decimals: number; disabled?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <div className={`${field} mt-2`}>
        <input id={id} value={value} onChange={(e) => onChange(decimalInput(e.target.value, decimals))} inputMode="decimal" disabled={disabled} className={input} />
        <span className={suffix}>{unit}</span>
      </div>
    </div>
  );
}

type Near = ReturnType<typeof useNearWallet>;

/** After create: read the new wallet back from the chain, then fund it and add the agent's key. */
function Created({
  flow,
  near,
  factory,
  judge,
  token,
}: {
  flow: Extract<Flow, { step: "created" }>;
  near: Near;
  factory: { codeHash: string } | null;
  judge: Judge | null;
  token: Token;
}) {
  const { walletId } = flow;
  const [checks, setChecks] = useState<{ label: string; ok: boolean }[] | null>(null);
  const [fund, setFund] = useState(token.symbol === "wNEAR" ? "0.05" : "1");
  const [fundState, setFundState] = useState<{ step: "idle" | "signing" } | { step: "done"; tx: string } | { step: "error"; message: string }>({ step: "idle" });
  const [newKey, setNewKey] = useState("");
  const [keyAllowance, setKeyAllowance] = useState("0.5");
  const [keyState, setKeyState] = useState<{ step: "idle" | "signing" } | { step: "done"; key: string; tx: string } | { step: "error"; message: string }>(
    flow.agentKey ? { step: "done", key: flow.agentKey, tx: flow.tx } : { step: "idle" },
  );

  // Show the proof: what the chain now says about the wallet, compared with what was asked for.
  useEffect(() => {
    let cancelled = false;
    Promise.all([viewOn<WalletConfig>(walletId, "get_config", {}), viewAccount(walletId)])
      .then(([c, a]) => {
        if (cancelled) return;
        setChecks([
          { label: `Owner is ${near.account}`, ok: c.owner_id === near.account },
          { label: "The rules' hash is the one you signed", ok: c.mandate_hash === flow.mandateHash },
          { label: `The judge is ${judge ? `${judge.signer.slice(0, 6)}…${judge.signer.slice(-4)}` : "the attested signer"}`, ok: !!judge && c.signers.includes(judge.signer.toLowerCase()) },
          { label: "It runs the factory's code", ok: !!factory && a?.code_hash === factory.codeHash },
          { label: "The wallet is its own agent", ok: c.agent_id === walletId },
        ]);
      })
      .catch(() => !cancelled && setChecks([]));
    return () => {
      cancelled = true;
    };
  }, [walletId, near.account, flow.mandateHash, judge, factory]);

  async function sendFunds() {
    const raw = parseUnits(fund, token.decimals);
    if (!raw || raw === "0" || !near.account) return;
    setFundState({ step: "signing" });
    try {
      const actions = fundActions(token, near.account, walletId, raw);
      const outcome = await (await near.wallet()).signAndSendTransaction({ signerId: near.account, receiverId: token.contract, actions });
      setFundState({ step: "done", tx: outcome.transaction.hash });
    } catch (e) {
      setFundState({ step: "error", message: errorText(e, "The wallet didn't sign") });
    }
  }

  async function addKey() {
    const k = newKey.trim();
    const raw = parseUnits(keyAllowance, 24);
    if (!ED25519_KEY.test(k) || !raw || raw === "0" || !near.account) return;
    setKeyState({ step: "signing" });
    try {
      const outcome = await (await near.wallet()).signAndSendTransaction({
        signerId: near.account,
        receiverId: walletId,
        actions: [call("add_agent_key", { public_key: k, allowance: raw })],
      });
      setKeyState({ step: "done", key: k, tx: outcome.transaction.hash });
    } catch (e) {
      setKeyState({ step: "error", message: errorText(e, "The wallet didn't sign") });
    }
  }

  return (
    <div className="pt-10 pb-24">
      <p className="flex items-center gap-3 text-[clamp(34px,4.2vw,56px)] leading-none font-black tracking-[-0.035em]">
        <Check className="size-[0.8em]" /> Created
      </p>
      <p className="mt-4 font-mono text-[clamp(17px,1.8vw,22px)] font-medium break-all">{walletId}</p>
      <p className="mt-2 text-mute">
        You own it, its rules are live, and it has no full-access key.{" "}
        <a href={nearblocksTx(flow.tx)} className="inline-flex items-center gap-1 text-text underline decoration-line underline-offset-4 hover:decoration-soft">
          Transaction <ArrowUpRight className="size-3.5" />
        </a>
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card step="On the chain" title="Check it">
          <p>Read back from the wallet contract just now:</p>
          {checks === null ? (
            <Loading label="Reading the wallet back from the chain">
              <div className="grid gap-2.5 pt-1">
                {["w-4/5", "w-3/5", "w-5/6", "w-2/3"].map((w) => (
                  <Skeleton key={w} className={`h-3.5 ${w}`} />
                ))}
              </div>
            </Loading>
          ) : checks.length === 0 ? (
            <p className="text-coral">Couldn&apos;t read the wallet yet. Reload in a moment.</p>
          ) : (
            <ul className="grid gap-1.5">
              {checks.map((c) => (
                <li key={c.label} className={`flex items-start gap-2 ${c.ok ? "text-text" : "text-coral"}`}>
                  {c.ok ? <Check className="mt-1 size-3.5 shrink-0 text-soft" /> : <Cross className="mt-1 size-3.5 shrink-0" />}
                  {c.label}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex flex-wrap gap-2">
            <Link href={walletHref(walletId)} className={secondary}>
              Open the wallet
            </Link>
            <a href={nearblocksAccount(walletId)} className={secondary}>
              nearblocks <ArrowUpRight className="size-4" />
            </a>
          </div>
        </Card>

        <Card step="Step 1" title="Fund it">
          <p>
            {token.symbol === "wNEAR"
              ? "Wrap NEAR into wNEAR and send it to the wallet, registering both accounts with wNEAR first. One approval."
              : `Send ${token.symbol} from your account, registering the wallet with the token first. One approval.`}
          </p>
          <div className={field}>
            <input aria-label="Amount to send" value={fund} onChange={(e) => setFund(decimalInput(e.target.value, token.decimals))} inputMode="decimal" className={input} disabled={fundState.step === "signing"} />
            <span className={suffix}>{token.symbol}</span>
          </div>
          {fundState.step === "done" && (
            <a href={nearblocksTx(fundState.tx)} className="inline-flex items-center gap-1 text-text underline decoration-line underline-offset-[3px] hover:decoration-soft">
              <Check className="size-3.5" /> Sent · transaction <ArrowUpRight className="size-3.5" />
            </a>
          )}
          {fundState.step === "error" && <p className="break-words text-coral">{fundState.message}</p>}
          <button onClick={sendFunds} disabled={fundState.step === "signing" || !parseUnits(fund, token.decimals)} className={`${primary} mt-auto`}>
            {fundState.step === "signing" ? "Approve in your wallet…" : fundState.step === "done" ? "Send more" : `Send ${fund} ${token.symbol}`}
          </button>
        </Card>

        <Card step="Step 2" title="Your agent's key">
          {keyState.step === "done" ? (
            <>
              <p>The wallet has your agent&apos;s key, limited to proposing and executing payments on it:</p>
              <p className="font-mono text-[13px] break-all text-soft">{keyState.key}</p>
              <p>
                Your agent proposes and executes as <span className="font-mono text-text">{walletId}</span>, with that key. Each payment needs a
                signed ALLOW for these rules.
              </p>
            </>
          ) : (
            <>
              <p>Add the agent&apos;s public key. It can only propose and execute payments on this wallet.</p>
              <div className={field}>
                <input aria-label="Agent public key" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="ed25519:…" spellCheck={false} className={`${input} font-mono text-sm`} disabled={keyState.step === "signing"} />
              </div>
              <div className={field}>
                <input aria-label="Gas allowance" value={keyAllowance} onChange={(e) => setKeyAllowance(decimalInput(e.target.value, 24))} inputMode="decimal" className={input} disabled={keyState.step === "signing"} />
                <span className={suffix}>NEAR gas limit</span>
              </div>
              <p className="text-[13px] text-mute">The most this key may spend on fees, out of the NEAR your deposit left in the wallet. Nothing is sent now.</p>
              {!newKey && <InitCommand name={walletId.slice(0, -FACTORY.length - 1)} then="prints the public key to paste here." />}
              {keyState.step === "error" && <p className="break-words text-coral">{keyState.message}</p>}
              <button onClick={addKey} disabled={keyState.step === "signing" || !ED25519_KEY.test(newKey.trim()) || !parseUnits(keyAllowance, 24)} className={`${primary} mt-auto`}>
                {keyState.step === "signing" ? "Approve in your wallet…" : "Add the key"}
              </button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-ink-2 p-[22px] text-sm text-mute">
      <p className="font-mono text-xs font-medium">{step}</p>
      <h2 className="text-[19px] font-black text-text">{title}</h2>
      {children}
    </section>
  );
}

function Intro() {
  return (
    <div className="max-w-[46em] pt-10 pb-2">
      <h1 className="text-[clamp(34px,4.2vw,60px)] leading-none font-black tracking-[-0.035em]">Create your wallet.</h1>
      <p className="mt-3 text-[17px] text-mute">
        A NEAR wallet your AI agent can spend from, but only on payments an AI in a secure enclave signs as matching your rules. You sign once
        in your own NEAR wallet; nothing to install. NEAR testnet.
      </p>
    </div>
  );
}

/** The Create page's shape for the moment before it can read ?name= and ?key= from the URL. */
export function CreateSkeleton() {
  return (
    <Loading label="Loading the create form">
      <Intro />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 pt-7 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="grid gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-3 h-12 w-full rounded-[14px]" />
            </div>
          ))}
        </div>
        <div className="rounded-[24px] bg-card p-[clamp(20px,2.4vw,28px)]">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-6 w-3/4" />
          <div className="mt-5 grid gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-3.5 w-full" />
            ))}
          </div>
          <Skeleton className="mt-6 h-14 w-full rounded-full" />
        </div>
      </div>
    </Loading>
  );
}
