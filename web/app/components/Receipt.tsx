import { ArrowUpRight, Check, Cross } from "./icons";
import {
  amount,
  nearTxUrl,
  outcome,
  OUTCOME_LABEL,
  payee,
  seconds,
  shortHash,
  splitReason,
  utcDate,
  utcTime,
  type Outcome,
  type Proposal,
} from "../lib/proposal";
import "./receipt.css";

const SUMMARY: Record<Outcome, (p: Proposal) => string> = {
  paid: () => "The wallet contract checked the signed ALLOW and paid.",
  refused: (p) =>
    p.near_tx_hash ? "Nothing was sent. The wallet contract refused the payment on-chain." : "Nothing was sent.",
  failed: () => "The payment did not go through.",
  judging: () => "NEAR AI Cloud is judging this payment against your rules.",
  approved: () => "Signed ALLOW. The wallet contract is paying.",
};

const SETTLED: Record<Outcome, (p: Proposal) => string> = {
  paid: () => "Paid on-chain",
  refused: (p) => (p.near_tx_hash ? "Refused on-chain" : "Refused"),
  failed: () => "Failed",
  judging: () => "Waiting",
  approved: () => "Paying",
};

const VERDICT_COLOUR: Record<Outcome, string> = {
  paid: "text-lime",
  refused: "text-coral",
  failed: "text-mute",
  judging: "text-soft",
  approved: "text-soft",
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
    <div className="mb-2 flex justify-between gap-3 font-mono text-[10px] font-medium tracking-[0.08em] text-mute uppercase">
      <span>{children}</span>
      {aside && <span>{aside}</span>}
    </div>
  );
}

export function Receipt({ proposal: p }: { proposal: Proposal }) {
  const kind = outcome(p);
  const { signed, error } = splitReason(p);
  const settled = kind === "judging" || kind === "approved";
  const total = amount(p);

  return (
    <article className="rcpt" aria-label={`Receipt for ${p.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 className={`flex items-center gap-3 text-[clamp(34px,3.4vw,46px)] leading-none font-black tracking-[-0.03em] ${VERDICT_COLOUR[kind]}`}>
          {kind === "paid" && <Check className="size-[0.8em]" />}
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
      </p>
      <p className="mt-1 text-sm text-mute">{SUMMARY[kind](p)}</p>

      <ol className="rcpt-steps text-[13px] text-mute">
        <li>
          <b className="block text-sm font-bold text-text">Proposed</b>
          <span className="font-mono text-xs">{utcTime(p.created_at)}</span>
        </li>
        <li className={p.verdict ? "" : "rcpt-pending"}>
          <b className="block text-sm font-bold text-text">Judged · {p.verdict ?? "no verdict"}</b>
          <span className="font-mono text-xs">{p.model ? `by ${p.model.split("/").pop()}` : "—"}</span>
        </li>
        <li className={settled ? "rcpt-pending" : `rcpt-${kind}`}>
          <b className="block text-sm font-bold text-text">{SETTLED[kind](p)}</b>
          <span className="font-mono text-xs">{settled ? "—" : `+${seconds(p)}`}</span>
        </li>
      </ol>

      {signed && (
        <section className="rcpt-section">
          <Label>The model’s reason, as signed</Label>
          <p className="text-[17px] leading-normal">&ldquo;{signed}&rdquo;</p>
        </section>
      )}

      {error && (
        <section className="rcpt-section">
          <Label>What went wrong</Label>
          <p className="rounded-xl border border-line bg-ink px-3.5 py-3 font-mono text-xs leading-relaxed break-words text-mute">{error}</p>
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
