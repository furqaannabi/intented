import { ArrowUpRight, Check, Cross } from "./icons";
import { Tag } from "./Tag";
import {
  amount,
  baseTxUrl,
  nearTxUrl,
  outcome,
  OUTCOME_LABEL,
  payee,
  seconds,
  shortHash,
  splitReason,
  utcDate,
  utcTime,
  walletAmount,
  walletOutcome,
  type OneClick,
  type Outcome,
  type Proposal,
} from "../lib/proposal";
import "./receipt.css";

const PAID_DEPOSIT = "The wallet contract checked the signed ALLOW and paid 1Click's deposit address.";
const SIMULATED = "1Click's delivery is simulated: on testnet nothing reaches Base.";

const SUMMARY: Record<Outcome, (p: Proposal) => string> = {
  paid: () => "The wallet contract checked the signed ALLOW and paid.",
  refused: (p) =>
    p.near_tx_hash ? "Nothing was sent. The wallet contract refused the payment on-chain." : "Nothing was sent.",
  failed: (p) => (p.oneclick && walletOutcome(p) === "paid" ? `${PAID_DEPOSIT} 1Click did not deliver.` : "The payment did not go through."),
  judging: () => "NEAR AI Cloud is judging this payment against your rules.",
  approved: () => "Signed ALLOW. The wallet contract is paying.",
  delivering: (p) => `${PAID_DEPOSIT} 1Click is delivering.${p.oneclick?.simulated ? ` ${SIMULATED}` : ""}`,
  delivered: (p) => `${PAID_DEPOSIT}${p.oneclick?.simulated ? ` ${SIMULATED}` : " 1Click delivered on Base."}`,
  refunded: () => `${PAID_DEPOSIT} 1Click refunded it to the wallet instead of delivering.`,
};

const SETTLED: Record<Outcome, (p: Proposal) => string> = {
  paid: (p) => (p.oneclick ? "Paid on NEAR" : "Paid on-chain"),
  refused: (p) => (p.near_tx_hash ? "Refused on-chain" : "Refused"),
  failed: () => "Failed",
  judging: () => "Waiting",
  approved: () => "Paying",
  delivering: () => "Paid on NEAR",
  delivered: () => "Paid on NEAR",
  refunded: () => "Paid on NEAR",
};

const VERDICT_COLOUR: Record<Outcome, string> = {
  paid: "text-lime",
  refused: "text-coral",
  failed: "text-mute",
  judging: "text-soft",
  approved: "text-soft",
  delivering: "text-soft",
  delivered: "text-lime",
  refunded: "text-mute",
};

/** The fourth step: 1Click's delivery, dashed while it is simulated. */
function DeliveryStep({ kind, oneclick: oc }: { kind: Outcome; oneclick: OneClick }) {
  const done = kind === "delivered";
  const cls = done ? (oc.simulated ? "rcpt-sim" : "rcpt-paid") : kind === "delivering" ? "rcpt-pending" : "rcpt-failed";
  const label = done ? `Delivered on ${chainName(oc.dest_chain)}` : kind === "refunded" ? "Refunded" : kind === "failed" ? "Not delivered" : "Delivering";
  return (
    <li className={cls}>
      <b className="block text-sm font-bold text-text">{label}</b>
      <span className="font-mono text-xs">{done && oc.simulated ? "simulated" : oc.status.toLowerCase().replace(/_/g, " ")}</span>
    </li>
  );
}

const chainName = (c: string) => (c === "base" ? "Base" : c);

/** 1Click's statuses, in words. */
const DELIVERY: Record<string, string> = {
  PENDING_DEPOSIT: "waiting for the deposit",
  KNOWN_DEPOSIT_TX: "deposit seen",
  PROCESSING: "processing",
  SUCCESS: "delivered",
  INCOMPLETE_DEPOSIT: "deposit too small",
  REFUNDED: "refunded to the wallet",
  FAILED: "failed",
};

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 text-text underline decoration-line underline-offset-[3px] hover:decoration-soft">
      {children}
      <ArrowUpRight className="size-3.5 shrink-0" />
    </a>
  );
}

function Label({ children, aside }: { children: React.ReactNode; aside?: string }) {
  return (
    <div className="mb-2 flex justify-between gap-3 font-mono text-[11px] font-medium tracking-[0.06em] text-mute uppercase">
      <span>{children}</span>
      {aside && <span>{aside}</span>}
    </div>
  );
}

export function Receipt({ proposal: p }: { proposal: Proposal }) {
  const kind = outcome(p);
  // The third step is the wallet's alone; a payment through 1Click adds the delivery after it.
  const wallet = walletOutcome(p);
  const { signed, error } = splitReason(p);
  const settled = wallet === "judging" || wallet === "approved";
  const total = amount(p);
  const oc = p.oneclick;

  return (
    <article className="rcpt" aria-label={`Receipt for ${p.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 className={`flex items-center gap-3 text-[clamp(34px,3.4vw,46px)] leading-none font-black tracking-[-0.03em] ${VERDICT_COLOUR[kind]}`}>
          {(kind === "paid" || kind === "delivered") && <Check className="size-[0.8em]" />}
          {kind === "refused" && <Cross className="size-[0.8em]" />}
          {OUTCOME_LABEL[kind]}
        </h2>
        <p className="font-mono text-xs text-mute sm:text-right">
          {p.id}
          <br />
          {utcDate(p.created_at)}
        </p>
      </div>

      <p className="mt-4 text-lg">
        {total && (
          <>
            <span className={`font-mono text-base ${kind === "refused" ? "text-mute line-through" : ""}`}>{total}</span> to{" "}
          </>
        )}
        <span className="font-mono text-base break-all">{payee(p)}</span>
        {oc && ` on ${chainName(oc.dest_chain)}`}
      </p>
      <p className="mt-1 text-sm text-mute">{SUMMARY[kind](p)}</p>

      <ol className={`rcpt-steps text-[13px] text-mute ${oc && wallet === "paid" ? "rcpt-steps-4" : ""}`}>
        <li>
          <b className="block text-sm font-bold text-text">Proposed</b>
          <span className="font-mono text-xs">{utcTime(p.created_at)}</span>
        </li>
        <li className={p.verdict ? "" : "rcpt-pending"}>
          <b className="block text-sm font-bold text-text">Judged · {p.verdict ?? "no verdict"}</b>
          <span className="font-mono text-xs">{p.model ? `by ${p.model.split("/").pop()}` : "—"}</span>
        </li>
        <li className={settled ? "rcpt-pending" : `rcpt-${wallet}`}>
          <b className="block text-sm font-bold text-text">{SETTLED[wallet](p)}</b>
          <span className="font-mono text-xs">{settled ? "—" : `+${seconds(p)}`}</span>
        </li>
        {oc && wallet === "paid" && <DeliveryStep kind={kind} oneclick={oc} />}
      </ol>

      {signed && (
        <section className="rcpt-section">
          <Label>The model’s reason, as signed</Label>
          {/* A reason can quote a 42-character 0x address; let it break rather than run off a phone screen. */}
          <p className="text-[17px] leading-normal [overflow-wrap:anywhere]">&ldquo;{signed}&rdquo;</p>
        </section>
      )}

      {error && (
        <section className="rcpt-section">
          <Label>What went wrong</Label>
          <p className="rounded-xl border border-line bg-ink px-3.5 py-3 font-mono text-xs leading-relaxed break-words text-mute">{error}</p>
        </section>
      )}

      {oc && wallet === "paid" && (
        <section className="rcpt-section">
          <Label aside={oc.simulated ? "simulated" : undefined}>Cross-chain, through 1Click</Label>
          <dl className="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)] [&_dd]:font-mono [&_dd]:text-[12.5px] [&_dd]:leading-relaxed [&_dd]:break-all [&_dt]:text-mute max-sm:[&_dt]:mt-2">
            <dt>Recipient</dt>
            <dd>
              {oc.recipient} on {chainName(oc.dest_chain)}
            </dd>
            <dt>Receives</dt>
            <dd>{oc.amount_out}</dd>
            <dt>Wallet paid</dt>
            <dd>{walletAmount(p) || "—"}</dd>
            <dt>Deposit address</dt>
            <dd>{oc.deposit_address}</dd>
            <dt>Delivery</dt>
            <dd>
              {DELIVERY[oc.status] ?? oc.status.toLowerCase().replace(/_/g, " ")} {oc.simulated && <Tag dashed>simulated</Tag>}
            </dd>
            <dt>{chainName(oc.dest_chain)} transaction</dt>
            <dd>
              {oc.simulated ? "none: simulated" : oc.dest_tx_hash ? <Link href={baseTxUrl(oc.dest_tx_hash)}>{shortHash(oc.dest_tx_hash)}</Link> : "—"}
            </dd>
          </dl>
          <p className="mt-2.5 text-[13px] leading-normal text-mute">
            The contract checks the payment to the deposit address. That 1Click delivers to the recipient is 1Click&rsquo;s word, checked afterwards through its status.
          </p>
        </section>
      )}

      {/* Not paid (refused, failed, or still being judged): 1Click only quoted, and the deposit address was never paid. */}
      {oc && wallet !== "paid" && (
        <section className="rcpt-section">
          <Label>Cross-chain, through 1Click</Label>
          <dl className="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)] [&_dd]:font-mono [&_dd]:text-[12.5px] [&_dd]:leading-relaxed [&_dd]:break-all [&_dt]:text-mute max-sm:[&_dt]:mt-2">
            <dt>Recipient</dt>
            <dd>
              {oc.recipient} on {chainName(oc.dest_chain)}
            </dd>
            <dt>Quoted</dt>
            <dd>
              {oc.amount_out}
              {walletAmount(p) && ` for ${walletAmount(p)}`}
            </dd>
          </dl>
          <p className="mt-2.5 text-[13px] leading-normal text-mute">
            {wallet === "judging" || wallet === "approved" ? "A quote so far: nothing has been sent to 1Click yet." : "A quote only: the wallet never paid 1Click's deposit address, so nothing was sent."}
          </p>
        </section>
      )}

      <section className="rcpt-section">
        <Label aside="untrusted · shown as data">What the agent read</Label>
        <pre className="max-h-40 overflow-auto rounded-xl border border-line bg-ink px-3.5 py-3 font-mono text-xs leading-[1.7] break-words whitespace-pre-wrap text-mute">
          {p.context_excerpt}
        </pre>
      </section>

      <section className="rcpt-section">
        <Label>Proof</Label>
        <dl className="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)] [&_dd]:font-mono [&_dd]:text-[12.5px] [&_dd]:leading-relaxed [&_dd]:break-all [&_dt]:text-mute max-sm:[&_dt]:mt-2">
          <dt>Action</dt>
          <dd>
            {p.action.method} on {p.action.receiver_id}
          </dd>
          <dt>Signer</dt>
          <dd>{p.signer ?? "—"}</dd>
          <dt>Signature</dt>
          <dd title={p.signature ?? undefined}>{p.signature ? shortHash(p.signature) : "—"}</dd>
          <dt>NEAR AI chat</dt>
          <dd>{p.chat_id ?? "—"}</dd>
          <dt>Attestation</dt>
          <dd>{p.attestation_url ? <Link href={p.attestation_url}>signer’s report</Link> : "—"}</dd>
          <dt>Transaction</dt>
          <dd>{p.near_tx_hash ? <Link href={nearTxUrl(p.near_tx_hash)}>{shortHash(p.near_tx_hash)}</Link> : "—"}</dd>
        </dl>
      </section>
    </article>
  );
}
