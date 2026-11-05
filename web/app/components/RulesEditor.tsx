"use client";

import { useState } from "react";
import { sha256Hex } from "../lib/near";
import type { useNearWallet } from "../lib/useNearWallet";
import { call } from "../lib/walletActions";
import { Check } from "./icons";

const MAX_CHARS = 2000; // POST /api/mandate's limit

const button = "inline-flex items-center gap-2 rounded-full px-5 py-3 text-[15px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const primary = `${button} bg-lime text-lime-ink`;
const secondary = `${button} border-[1.5px] border-line bg-ink-2 text-text hover:border-soft`;

type Step = { step: "edit" } | { step: "saving" } | { step: "signing"; hash: string };

const short = (s: string) => (s.length > 17 ? `${s.slice(0, 8)}…${s.slice(-8)}` : s);

/**
 * The owner rewrites a wallet's rules: the text is saved to the API, its hash is checked here, and the owner signs
 * set_mandate on the wallet in their own NEAR wallet. The caller shows the outcome and reads the wallet again. If saving
 * or signing fails, the editor stays open with the draft and says why, so nothing typed is lost.
 */
export function RulesEditor({
  walletId,
  current,
  signerId,
  wallet,
  onDone,
  onCancel,
  large = true,
}: {
  walletId: string;
  current: string;
  signerId: string;
  wallet: ReturnType<typeof useNearWallet>["wallet"];
  onDone: (txHash: string) => void;
  onCancel: () => void;
  large?: boolean;
}) {
  const [draft, setDraft] = useState(current);
  const [step, setStep] = useState<Step>({ step: "edit" });
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setStep({ step: "saving" });
    try {
      const res = await fetch("/api/mandate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: draft }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `The API answered ${res.status}`);
      // Never ask the owner to sign a hash we didn't compute ourselves.
      const hash = await sha256Hex(draft);
      if (body?.text_hash !== hash) throw new Error("The API's hash for this text doesn't match the one computed here; nothing was signed");
      setStep({ step: "signing", hash });
      const outcome = await (await wallet()).signAndSendTransaction({ signerId, receiverId: walletId, actions: [call("set_mandate", { text_hash: hash })] });
      onDone(outcome.transaction.hash);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The wallet didn't sign");
      setStep({ step: "edit" });
    }
  }

  return (
    <>
      <label htmlFor={`rules-draft-${walletId}`} className="mt-4 mb-2 block text-xs text-mute">
        Write the rules in plain English
      </label>
      <textarea
        id={`rules-draft-${walletId}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={MAX_CHARS}
        disabled={step.step !== "edit"}
        className={`min-h-[150px] w-full resize-y rounded-2xl border-[1.5px] border-line bg-ink p-[18px] leading-snug font-medium text-text outline-none focus:border-soft disabled:opacity-70 ${large ? "text-xl" : "text-[17px]"}`}
      />
      <div className="mt-2 flex justify-between gap-4 text-xs text-mute">
        <span>Saved exactly as typed; spaces and line breaks count.</span>
        <span className="font-mono">
          {draft.length} / {MAX_CHARS}
        </span>
      </div>
      <p className="mt-4 rounded-[14px] border border-line bg-ink px-4 py-3.5 text-[13px] text-mute">
        <b className="font-bold text-text">The agent switches to these rules on its next payment.</b> The contract&apos;s limits still apply: rules can
        only tighten them, never loosen them.
      </p>
      {error && step.step === "edit" && (
        <p className="mt-4 text-sm break-words text-coral" role="alert">
          {error.replace(/\.$/, "")}. Your text is kept; you can try again.
        </p>
      )}
      {step.step === "edit" ? (
        <div className="mt-6 flex flex-wrap gap-2.5">
          <button onClick={save} disabled={!draft || draft === current} className={primary}>
            Save and sign
          </button>
          <button onClick={onCancel} className={secondary}>
            Cancel
          </button>
        </div>
      ) : (
        <ol className="mt-6 grid gap-2.5 text-sm">
          <StepRow n={1} state={step.step === "saving" ? "now" : "done"} title="Save the text" />
          <StepRow
            n={2}
            state={step.step === "signing" ? "now" : "todo"}
            title="Approve set_mandate in your wallet"
            note={step.step === "signing" ? `sha256 ${short(step.hash)} · waiting for your wallet` : undefined}
          />
          <StepRow n={3} state="todo" title="Confirmed on-chain" />
        </ol>
      )}
    </>
  );
}

function StepRow({ n, state, title, note }: { n: number; state: "done" | "now" | "todo"; title: string; note?: string }) {
  const badge = { done: "bg-card text-text", now: "bg-soft text-ink", todo: "bg-line text-mute" }[state];
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
