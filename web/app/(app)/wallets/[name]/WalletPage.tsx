"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Cross } from "../../../components/icons";
import { PaymentsChart } from "../../../components/PaymentsChart";
import { RulesEditor } from "../../../components/RulesEditor";
import { Loading, Skeleton } from "../../../components/Skeleton";
import { REPO } from "../../../components/SiteHeader";
import { FACTORY_ID, formatUnits, freeNear, nearblocksAccount, nearblocksTx, parseUnits, TESTNET_TOKENS, viewOn, WALLET_ID } from "../../../lib/near";
import { rememberWallet, walletFromPath } from "../../../lib/myWallets";
import { useNearWallet } from "../../../lib/useNearWallet";
import { call, ED25519_KEY, fundActions, transfer, WITHDRAW_GAS, type FunctionCall, type Transfer } from "../../../lib/walletActions";
import { loadWallet, type WalletState } from "../../../lib/walletState";
import { Pill } from "../MyWallets";

const button = "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const primary = `${button} bg-lime text-lime-ink`;
const secondary = `${button} border-[1.5px] border-line bg-ink-2 text-text hover:border-soft`;
const active = `${button} border-[1.5px] border-soft bg-card text-text`;
const danger = `${button} border-[1.5px] border-[#4a1f1a] bg-[#1f1311] text-coral`;
const field = "flex items-center overflow-hidden rounded-[12px] border-[1.5px] border-line bg-ink focus-within:border-soft";
const input = "min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none";

/** Which owner form is open under the header. */
type Panel = "fund" | "withdraw" | null;

/** What the owner last signed on this page: in the wallet, done with its transaction, or refused. */
type Tx = { what: string; step: "signing" } | { what: string; step: "done"; hash: string } | { what: string; step: "error"; message: string } | null;

const short = (s: string, head = 6, tail = 4) => (s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s);
const near2 = (raw: string) => Number(formatUnits(raw, 24)).toFixed(2);

/** /wallets/<name>: the wallet, or a plain note if the name isn't an Intented wallet's. */
export function WalletRoute() {
  const segment = String(useParams<{ name: string }>().name ?? "");
  const walletId = walletFromPath(segment);
  if (walletId)
    return (
      <>
        <title>{`${walletId} · Intented`}</title>
        <WalletPage key={walletId} walletId={walletId} />
      </>
    );
  return (
    <p className="my-10 max-w-[40em] rounded-[18px] border border-line bg-ink-2 p-5 text-sm text-mute">
      <span className="font-mono break-all text-text">{decodeURIComponent(segment)}</span> isn&apos;t an Intented wallet name.
    </p>
  );
}

function WalletPage({ walletId }: { walletId: string }) {
  const near = useNearWallet();
  const [state, setState] = useState<WalletState | null | "loading" | "error">("loading");
  const [factoryCode, setFactoryCode] = useState<string | null>(null);
  const [tx, setTx] = useState<Tx>(null);
  const [editingRules, setEditingRules] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  const load = useCallback(async () => {
    try {
      const s = await loadWallet(walletId);
      setState(s);
      // The demo wallet is one click away in the header, so it doesn't join your list.
      if (s && walletId !== WALLET_ID) rememberWallet(walletId);
    } catch {
      setState("error");
    }
  }, [walletId]);

  useEffect(() => {
    // Reading from the chain on mount is a sync with an external system; the setState calls happen after awaits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    viewOn<string>(FACTORY_ID, "get_code_hash", {}).then(setFactoryCode, () => setFactoryCode(null));
  }, [load]);

  const isOwner = typeof state === "object" && !!state && near.account === state.config.owner_id;

  /** Sign one transaction in the owner's wallet, then read the wallet again. True if it went through. */
  async function sign(what: string, receiverId: string, actions: (FunctionCall | Transfer)[]): Promise<boolean> {
    if (!near.account) return false;
    setTx({ what, step: "signing" });
    let ok = false;
    try {
      const outcome = await (await near.wallet()).signAndSendTransaction({ signerId: near.account, receiverId, actions });
      setTx({ what, step: "done", hash: outcome.transaction.hash });
      ok = true;
    } catch (e) {
      setTx({ what, step: "error", message: e instanceof Error && e.message ? e.message : "The wallet didn't sign" });
    }
    await load();
    return ok;
  }

  if (state === "loading") return <WalletSkeleton walletId={walletId} />;
  if (state === "error" || state === null) {
    return (
      <div className="my-10 max-w-[40em] rounded-[18px] border border-line bg-ink-2 p-5 text-sm text-mute">
        {state === null ? (
          <>
            No account named <span className="font-mono break-all text-text">{walletId}</span> on NEAR testnet.{" "}
            <Link href="/create" className="text-text underline underline-offset-[3px]">
              Create it
            </Link>
          </>
        ) : (
          <>
            Couldn&apos;t read <span className="font-mono text-text">{walletId}</span> from NEAR testnet.{" "}
            <button onClick={load} className="font-bold text-text underline underline-offset-[3px]">
              Try again
            </button>
          </>
        )}
      </div>
    );
  }

  const { config, account, tokens, agentKeys, fullAccessKeys, rules } = state;
  const busy = tx?.step === "signing";

  return (
    <div className="pb-24">
      <p className="pt-7 text-sm text-mute">
        <Link href="/wallets" className="hover:text-text">
          ← My wallets
        </Link>
      </p>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-3.5 pb-6">
        <div className="min-w-0">
          {/* Breaks before ".intented.testnet" on a narrow screen, not mid-word; a label too long for one line still wraps. */}
          <h1 className="font-mono text-[clamp(22px,2.6vw,34px)] leading-tight font-medium [overflow-wrap:anywhere]">
            {walletId.slice(0, walletId.indexOf(".") + 1 || undefined)}
            <wbr />
            {walletId.indexOf(".") < 0 ? "" : walletId.slice(walletId.indexOf(".") + 1)}
          </h1>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Pill>owner {config.owner_id}</Pill>
            {factoryCode && account.code_hash === factoryCode && <Pill tone="ok">factory code ✓</Pill>}
            {fullAccessKeys > 0 && <Pill tone="warn">{fullAccessKeys} full-access key{fullAccessKeys > 1 ? "s" : ""}</Pill>}
            <Pill tone={config.frozen ? "warn" : undefined}>{config.frozen ? "frozen" : "active"}</Pill>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {isOwner && (
            <>
              <button onClick={() => setPanel(panel === "fund" ? null : "fund")} disabled={busy} aria-expanded={panel === "fund"} className={panel === "fund" ? active : primary}>
                Fund
              </button>
              <button onClick={() => setPanel(panel === "withdraw" ? null : "withdraw")} disabled={busy} aria-expanded={panel === "withdraw"} className={panel === "withdraw" ? active : secondary}>
                Withdraw
              </button>
              <button
                disabled={busy}
                onClick={() => sign(config.frozen ? "Unfreeze" : "Freeze", walletId, [call(config.frozen ? "unfreeze" : "freeze", {})])}
                title={config.frozen ? "Payments can execute again, within the rules and limits." : "Nothing executes until you unfreeze. Withdraw still works."}
                className={config.frozen ? secondary : danger}
              >
                {config.frozen ? "Unfreeze" : "Freeze"}
              </button>
            </>
          )}
          <a href={nearblocksAccount(walletId)} className={secondary}>
            nearblocks <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>

      {isOwner && panel && <OwnerPanel key={panel} kind={panel} state={state} walletId={walletId} owner={near.account!} busy={busy} sign={sign} onClose={() => setPanel(null)} />}

      {tx && (
        <p className={`mb-5 flex flex-wrap items-center gap-2 text-sm ${tx.step === "error" ? "text-coral" : "text-text"}`} aria-live="polite">
          {tx.step === "signing" && <>Approve “{tx.what}” in your wallet…</>}
          {tx.step === "done" && (
            <>
              <Check className="size-4 text-lime" /> {tx.what} ·{" "}
              <a href={nearblocksTx(tx.hash)} className="font-mono text-soft hover:underline">
                {short(tx.hash, 8, 8)}
              </a>
            </>
          )}
          {tx.step === "error" && (
            <>
              <Cross className="size-3.5" /> {tx.what}: {tx.message}
            </>
          )}
        </p>
      )}

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Tile k="Can pay" v={tokens.map((t) => `${t.balance === null ? "—" : formatUnits(t.balance, t.token.decimals)} ${t.token.symbol}`).join(" · ") || "—"} s={isOwner ? "Fund it from the top of the page, with one approval" : "The tokens the agent can pay in"} />
        {config.agent_id === walletId ? (
          <>
            <GasTile account={account} agentKeys={agentKeys} />
            <Tile
              k="Agent"
              v={agentKeys.length ? `${agentKeys.length} key${agentKeys.length > 1 ? "s" : ""}` : "No key"}
              s={agentKeys.length ? "Each can propose and execute payments on this wallet, nothing else" : "Add your agent's key in the Agent card below"}
            />
          </>
        ) : (
          <>
            <Tile k="NEAR" v={`${near2(account.amount)} NEAR`} s={`${near2(freeNear(account))} free to withdraw; the rest is locked for storage`} />
            <Tile k="Agent" v={config.agent_id} s="A separate account, which pays its own gas" />
          </>
        )}
      </div>

      {tokens[0] && (
        <div className="mb-6">
          <Card
            title="Payments"
            lead={`${tokens[0].token.symbol} per day (UTC), last 14 days: what the wallet paid, what the verdict refused, and what failed.`}
            link={<Link href={walletId === WALLET_ID ? "/activity" : `/activity?wallet=${walletId}`}>Open its activity →</Link>}
          >
            <PaymentsChart walletId={walletId} tokenId={tokens[0].id} token={tokens[0].token} />
          </Card>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="grid gap-6">
          <Card
            title="Rules"
            link={
              isOwner && !editingRules ? (
                <button onClick={() => setEditingRules(true)} disabled={busy}>
                  Edit
                </button>
              ) : undefined
            }
          >
            {editingRules && isOwner ? (
              <RulesEditor
                walletId={walletId}
                current={rules.state === "live" ? rules.text : ""}
                signerId={near.account!}
                wallet={near.wallet}
                large={false}
                onDone={(hash) => {
                  setEditingRules(false);
                  setTx({ what: "Set the rules", step: "done", hash });
                  load();
                }}
                onError={(message) => {
                  setEditingRules(false);
                  setTx({ what: "Set the rules", step: "error", message });
                }}
                onCancel={() => setEditingRules(false)}
              />
            ) : rules.state === "live" ? (
              <>
                <p className="mt-4 flex items-center gap-2 text-xs font-black tracking-[0.12em] text-lime uppercase">
                  <Check className="size-3.5" /> Live on the wallet
                </p>
                <p className="mt-2.5 text-[clamp(20px,1.9vw,26px)] leading-tight font-bold tracking-[-0.015em] [overflow-wrap:anywhere]">{rules.text}</p>
                <p className="mt-3 text-[13px] text-mute">
                  sha256 <span className="font-mono">{short(config.mandate_hash ?? "", 8, 16)}</span> matches the hash on the wallet. Your browser
                  hashed the text itself.
                </p>
              </>
            ) : (
              <p className="mt-3 text-mute">
                {rules.state === "none"
                  ? "No rules are set on this wallet, so every payment is refused."
                  : rules.state === "mismatch"
                    ? "The API returned a text whose hash isn't the wallet's, so it isn't shown."
                    : "The text of these rules isn't available from the API right now."}
              </p>
            )}
          </Card>

        </div>

        <div className="grid gap-6">
          <Card title="Hard limits" lead="The contract enforces these whatever the AI says.">
            <dl className="mt-3.5 text-sm">
              {tokens.flatMap((t) => [
                <Limit key={`${t.id}-tx`} label={`${t.token.symbol} per payment`} value={formatUnits(t.token.caps.per_tx, t.token.decimals)} />,
                <Limit key={`${t.id}-day`} label={`${t.token.symbol} per day (UTC)`} value={formatUnits(t.token.caps.daily, t.token.decimals)} />,
              ])}
              <Limit label="Contracts it can call" value={config.receivers.join(", ") || "none"} mono />
              <Limit
                label="Judge"
                value={
                  <a href={`${REPO}/tree/main/docs/attestations`} className="hover:underline">
                    {config.signers.map((s) => short(s)).join(", ")} · {config.model_id.split("/").pop()}
                  </a>
                }
                mono
              />
            </dl>
          </Card>

          <AgentCard state={state} walletId={walletId} isOwner={isOwner} busy={busy} sign={sign} />

          {!isOwner && (
            <p className="rounded-[22px] border border-dashed border-line p-5 text-[13.5px] text-mute">
              {near.account ? (
                <>
                  Signed in as <span className="font-mono text-text">{near.account}</span>. Only the owner,{" "}
                  <span className="font-mono text-text">{config.owner_id}</span>, can edit the rules, fund, freeze or withdraw.
                </>
              ) : (
                <>
                  The owner,{" "}
                  <span className="font-mono text-text">{config.owner_id}</span>, can edit the rules, fund, freeze or withdraw here.{" "}
                  <button onClick={near.connect} disabled={near.status !== "ready"} className="font-bold text-text underline underline-offset-[3px] disabled:opacity-45">
                    Connect
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type Sign = (what: string, receiverId: string, actions: (FunctionCall | Transfer)[]) => Promise<boolean>;

function AgentCard({ state, walletId, isOwner, busy, sign }: { state: WalletState; walletId: string; isOwner: boolean; busy: boolean; sign: Sign }) {
  const [key, setKey] = useState("");
  const [allowance, setAllowance] = useState("0.5");
  const k = key.trim();
  const raw = parseUnits(allowance, 24);
  const ok = ED25519_KEY.test(k) && !!raw && raw !== "0";
  // Our own wallet's agent is a separate account; a factory wallet is its own agent, with keys on itself.
  const ownAgent = state.config.agent_id === walletId;

  // Every key's gas comes from the wallet's free NEAR. If all their limits, this one included, add up to more,
  // the missing NEAR can go in the same transaction as the key.
  const free = BigInt(freeNear(state.account));
  const limits = state.agentKeys.reduce((sum, a) => sum + BigInt(a.allowance ?? "0"), BigInt(raw && ok ? raw : "0"));
  // Rounded up to the next 0.01 NEAR, so the amount shown is the amount sent.
  const cent = BigInt("10000000000000000000000");
  const short = ok && !state.agentKeys.some((a) => a.allowance === null) && limits > free ? (((limits - free + cent - BigInt(1)) / cent) * cent).toString() : null;
  const [cover, setCover] = useState(true);
  const sendNear = short !== null && cover;

  function addKey() {
    const add = call("add_agent_key", { public_key: k, allowance: raw });
    sign(sendNear ? `Add the agent key and ${near2(short)} NEAR for gas` : "Add the agent key", walletId, sendNear ? [transfer(short), add] : [add]).then(
      (done) => done && setKey(""),
    );
  }

  return (
    <Card title="Agent" lead={ownAgent ? "Keys that can propose and execute on this wallet, nothing else." : `The agent is ${state.config.agent_id}.`}>
      {ownAgent &&
        (state.agentKeys.length ? (
          state.agentKeys.map((a) => (
            <div key={a.public_key} className="mt-3.5 grid gap-1.5 rounded-[14px] border border-line p-3.5">
              <code className="font-mono text-[13px] break-all text-soft">{a.public_key}</code>
              <p className="text-[13px] text-mute">
                Gas limit left: {a.allowance === null ? "unlimited" : `${near2(a.allowance)} NEAR`} · {a.method_names.join(", ")}
              </p>
              {isOwner && (
                <div>
                  <button disabled={busy} onClick={() => sign("Remove the agent key", walletId, [call("remove_agent_key", { public_key: a.public_key })])} className={secondary}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="mt-3 text-sm text-mute">No agent key yet{isOwner ? ": add the public key your agent printed." : "."}</p>
        ))}
      {ownAgent && isOwner && (
        <div className="mt-4 grid gap-2.5">
          <div className={field}>
            <input aria-label="Agent public key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="ed25519:…" spellCheck={false} className={`${input} font-mono`} />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <div className={`${field} w-[180px]`}>
              <input aria-label="Gas allowance" value={allowance} onChange={(e) => setAllowance(e.target.value)} inputMode="decimal" className={input} />
              <span className="px-3 font-mono text-xs text-mute">NEAR gas</span>
            </div>
            <button
              disabled={busy || !ok}
              onClick={addKey}
              className={secondary}
            >
              {sendNear ? `Add the key and ${near2(short)} NEAR` : "Add a key"}
            </button>
          </div>
          {short !== null && (
            <div className="rounded-[12px] border border-line bg-ink px-3.5 py-2.5 text-[13px] text-mute">
              <p>
                The wallet has {near2(free.toString())} NEAR free for gas, and its keys&apos; limits{state.agentKeys.length ? ", this one included," : ""} come to{" "}
                {near2(limits.toString())}.
              </p>
              <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-text">
                <input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} className="size-4 accent-lime" />
                Also send {near2(short)} NEAR from your account, so it can cover them
              </label>
            </div>
          )}
          {k && !ED25519_KEY.test(k) && <p className="text-[13px] text-coral">An ed25519 public key: ed25519: then 43 or 44 base58 characters.</p>}
        </div>
      )}
    </Card>
  );
}

/**
 * The form a header button opens, just under the wallet's name: Fund or Withdraw. It closes once the transaction goes
 * through, and stays open with the amount on a refusal, so the owner can try again.
 */
function OwnerPanel({
  kind,
  state,
  walletId,
  owner,
  busy,
  sign,
  onClose,
}: {
  kind: "fund" | "withdraw";
  state: WalletState;
  walletId: string;
  owner: string;
  busy: boolean;
  sign: Sign;
  onClose: () => void;
}) {
  const tokens = state.tokens.map((t) => ({ ...t, known: TESTNET_TOKENS.find((k) => k.contract === t.id) }));
  const fundable = tokens.filter((t) => t.known);
  const [pick, setPick] = useState(0); // fund: an index into fundable; withdraw: into tokens, or tokens.length for NEAR
  const [amount, setAmount] = useState("");

  // Withdraw lists NEAR last: what's above the storage lock. Fund is payment tokens only; gas NEAR comes with the deposit or a key.
  const isNear = kind === "withdraw" && pick >= tokens.length;
  const ft = kind === "fund" ? fundable[pick] : undefined;
  const decimals = isNear ? 24 : kind === "fund" ? (ft?.token.decimals ?? 24) : tokens[pick].token.decimals;
  const raw = parseUnits(amount, decimals);
  const max = kind === "withdraw" ? (isNear ? freeNear(state.account) : (tokens[pick].balance ?? "0")) : null;
  const over = !!raw && max !== null && BigInt(raw) > BigInt(max);
  const symbol = isNear ? "NEAR" : kind === "fund" ? (ft?.token.symbol ?? "") : tokens[pick].token.symbol;

  async function submit() {
    if (!raw) return;
    const ok =
      kind === "fund"
        ? ft && (await sign(`Fund ${amount} ${symbol}`, ft.id, fundActions(ft.known!, owner, walletId, raw)))
        : await sign(`Withdraw ${amount} ${symbol}`, walletId, [call("withdraw", { token_id: isNear ? null : tokens[pick].id, amount: raw }, "0", WITHDRAW_GAS)]);
    if (ok) onClose();
  }

  const options = kind === "fund" ? fundable.map((t) => t.token.symbol) : [...tokens.map((t) => t.token.symbol), "NEAR"];

  return (
    <section className="mb-6 rounded-[22px] border border-line bg-ink-2 p-5" aria-label={kind === "fund" ? "Fund the wallet" : "Withdraw from the wallet"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-[-0.01em]">{kind === "fund" ? "Fund" : "Withdraw"}</h2>
          <p className="text-[13px] text-mute">
            {kind === "fund"
              ? symbol === "wNEAR"
                  ? "Wrap NEAR from your account and send it to the wallet, in one approval. The agent pays with it."
                  : `Send ${symbol} from your account to the wallet. The agent pays with it.`
              : `Back to ${owner}. Not judged: your money is yours.`}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-mute hover:bg-card hover:text-text">
          <Cross className="size-3.5" />
        </button>
      </div>
      {kind === "fund" && !ft ? (
        <p className="mt-3 text-sm text-mute">This wallet pays in a token the app can&apos;t fund from here; send it to the wallet from your own NEAR wallet.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mt-3.5 flex flex-wrap gap-2.5 text-sm"
        >
          {options.length > 1 && (
            <div className="relative">
              {/* The browser's own arrow sits against the edge; ours keeps 12px of room. */}
              <select
                aria-label="Asset"
                value={pick}
                onChange={(e) => setPick(Number(e.target.value))}
                className={`${field} h-full cursor-pointer appearance-none py-2 pr-9 pl-3`}
              >
                {options.map((o, i) => (
                  <option key={o + i} value={i}>
                    {o}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-mute" />
            </div>
          )}
          <div className={`${field} w-[200px]`}>
            <input
              aria-label={kind === "fund" ? "Amount to send" : "Amount to withdraw"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={kind === "fund" ? "0.05" : "0"}
              inputMode="decimal"
              autoFocus
              className={input}
            />
            {max !== null ? (
              <button type="button" onClick={() => setAmount(formatUnits(max, decimals))} className="px-3 text-xs font-bold text-mute hover:text-text">
                max
              </button>
            ) : (
              <span className="px-3 font-mono text-xs text-mute">{symbol}</span>
            )}
          </div>
          <button type="submit" disabled={busy || !raw || raw === "0" || over} className={kind === "fund" ? primary : secondary}>
            {kind === "fund" ? `Fund ${symbol}` : `Withdraw ${symbol}`}
          </button>
        </form>
      )}
      {over && max !== null && <p className="mt-2 text-[13px] text-coral">More than the wallet can send: at most {formatUnits(max, decimals)}.</p>}
      {kind === "withdraw" && isNear && <p className="mt-2 text-[12.5px] text-mute">The NEAR its storage locks stays; the agent&apos;s gas comes from what&apos;s left.</p>}
    </section>
  );
}

/** The wallet page's shape while it is read from the chain. The name comes from the URL, so it shows at once. */
export function WalletSkeleton({ walletId }: { walletId: string | null }) {
  const tile = (k: string) => (
    <div className="rounded-[20px] bg-card p-5">
      <p className="font-mono text-[11px] font-medium tracking-[0.1em] text-mute uppercase">{k}</p>
      <Skeleton className="mt-3 h-[clamp(24px,2.4vw,32px)] w-2/3" />
      <Skeleton className="mt-2.5 h-3 w-4/5" />
    </div>
  );
  const lines = (...widths: string[]) => widths.map((w, i) => <Skeleton key={i} className={`mt-3 h-3.5 ${w}`} />);
  return (
    <Loading label="Reading the wallet from NEAR testnet">
      <div className="pb-24">
        <p className="pt-7 text-sm text-mute">
          <Link href="/wallets" className="hover:text-text">
            ← My wallets
          </Link>
        </p>
        <div className="pt-3.5 pb-6">
          {walletId ? (
            <p className="font-mono text-[clamp(22px,2.6vw,34px)] leading-tight font-medium break-all">{walletId}</p>
          ) : (
            <Skeleton className="h-[clamp(28px,3vw,40px)] w-[min(100%,520px)]" />
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Skeleton className="h-6 w-48 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {tile("Can pay")}
          {tile(walletId === WALLET_ID ? "NEAR" : "Gas for the agent")}
          {tile("Agent")}
        </div>
        <div className="mb-6">
          <Card title="Payments">
            {lines("w-1/2")}
            <Skeleton className="mt-6 h-[220px] w-full rounded-[14px]" />
          </Card>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="grid gap-6">
            <Card title="Rules">{lines("w-1/3", "w-[96%]", "w-[88%]", "w-1/2")}</Card>
          </div>
          <div className="grid gap-6">
            <Card title="Hard limits">{lines("w-full", "w-full", "w-4/5", "w-3/5")}</Card>
            <Card title="Agent">{lines("w-full", "w-2/3")}</Card>
          </div>
        </div>
      </div>
    </Loading>
  );
}

function Tile({ k, v, s, low }: { k: string; v: string; s: React.ReactNode; low?: boolean }) {
  return (
    <div className={`rounded-[20px] bg-card p-5 ${low ? "ring-1 ring-coral/60" : ""}`}>
      <p className="font-mono text-[11px] font-medium tracking-[0.1em] text-mute uppercase">{k}</p>
      <p className={`mt-2 text-[clamp(22px,2.4vw,32px)] font-black tracking-[-0.02em] break-words ${low ? "text-coral" : ""}`}>{v}</p>
      <p className="mt-1 text-[13px] text-mute">{s}</p>
    </div>
  );
}

/** Below this, the agent is a few payments from stopping. */
const LOW_GAS = BigInt("50000000000000000000000"); // 0.05 NEAR

/**
 * What the agent can really spend on gas: the wallet's NEAR above its storage lock, or its keys' limit if that is smaller.
 * Says which of the two is the limit, and what to do when it runs low.
 */
function GasTile({ account, agentKeys }: { account: WalletState["account"]; agentKeys: WalletState["agentKeys"] }) {
  const free = BigInt(freeNear(account));
  const locked = (BigInt(account.amount) - free).toString();
  const unlimited = agentKeys.some((a) => a.allowance === null);
  const limit = agentKeys.reduce((sum, a) => sum + BigInt(a.allowance ?? "0"), BigInt(0));
  const keyBound = agentKeys.length > 0 && !unlimited && limit < free;
  const usable = keyBound ? limit : free;
  const low = usable < LOW_GAS;

  const keys = agentKeys.length > 1 ? "The agent's keys together" : "The agent's key";
  const why = !agentKeys.length
    ? `Free NEAR in the wallet, for the agent's gas once it has a key. ${near2(locked)} more is locked for storage.`
    : keyBound
      ? `${keys} limit. The wallet has ${near2(free.toString())} NEAR free; ${near2(locked)} more is locked for storage.`
      : `Free NEAR in the wallet.${unlimited ? "" : ` ${keys} may spend up to ${near2(limit.toString())};`} ${near2(locked)} more is locked for storage.`;
  const fix = keyBound
    ? `Low: ${agentKeys.length > 1 ? "the keys' limits are" : "the key's limit is"} nearly used. Add a key with a new limit to keep the agent paying.`
    : "Low: send NEAR to this wallet from your NEAR wallet, or with Add a key below, to keep the agent paying.";

  return (
    <Tile
      k="Gas for the agent"
      v={`${near2(usable.toString())} NEAR`}
      low={low && agentKeys.length > 0}
      s={low && agentKeys.length > 0 ? <><b className="font-bold text-coral">{fix}</b> {why}</> : why}
    />
  );
}

function Card({ title, lead, link, children }: { title: string; lead?: string; link?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-line bg-ink-2 p-6">
      <h2 className="flex items-center justify-between gap-3 text-xl font-black tracking-[-0.01em]">
        {title}
        {link && <span className="text-sm font-medium text-mute hover:text-text">{link}</span>}
      </h2>
      {lead && <p className="mt-1 text-[13px] text-mute">{lead}</p>}
      {children}
    </section>
  );
}

function Limit({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3.5 border-t border-line py-2.5">
      <dt className="text-mute">{label}</dt>
      <dd className={`text-right font-medium break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

