// Checks a wallet's execute transaction from the chain alone, without the API or the web app:
// recomputes the text NEAR AI signed from execute's own arguments, recovers the signer, and says
// whether the wallet allowlists it, what the model answered, how execute ended and what moved.
//
// The command is src/check.ts: pnpm check-tx <wallet> <execute tx hash>

import { createHash } from "node:crypto";
import { verifyMessage } from "ethers";

/** What the RPC's tx method returns, as far as this reads it. */
export interface RpcTx {
  transaction: { actions: ({ FunctionCall?: { method_name: string; args: string } } | string)[] };
  status: { SuccessValue?: string; Failure?: unknown };
  receipts_outcome: { outcome: { executor_id: string; logs: string[] } }[];
}
/** The wallet's get_config, as far as this reads it. */
export interface WalletConfig {
  model_id: string;
  signers: string[];
}

export interface ExecuteCheck {
  /** `model:sha256(request):sha256(response)`, what NEAR AI signed and the contract checks. */
  signedText: string;
  signer: string;
  allowlisted: boolean;
  verdict: string;
  reason: string;
  outcome: { ok: true } | { ok: false; error: string };
  /** Token transfers the transaction made, from the token contracts' own logs. */
  transfers: { token: string; from: string; to: string; amount: string }[];
}

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

export function checkExecute(tx: RpcTx, config: WalletConfig): ExecuteCheck {
  const call = tx.transaction.actions.map((a) => (typeof a === "string" ? undefined : a.FunctionCall)).find((f) => f?.method_name === "execute");
  if (!call) throw new Error("that transaction is not an execute");
  const args = JSON.parse(Buffer.from(call.args, "base64").toString("utf8")) as { req_bytes: string; resp_bytes: string; sig_65: string };
  const req = Buffer.from(args.req_bytes, "base64");
  const resp = Buffer.from(args.resp_bytes, "base64");

  const signedText = `${config.model_id}:${sha256(req)}:${sha256(resp)}`;
  const signer = verifyMessage(signedText, args.sig_65).toLowerCase();
  // The model's answer, inside the signed response.
  const answer = JSON.parse(JSON.parse(resp.toString("utf8")).choices[0].message.content) as { verdict: string; reason: string };

  return {
    signedText,
    signer,
    allowlisted: config.signers.some((s) => s.toLowerCase() === signer),
    verdict: answer.verdict,
    reason: answer.reason,
    outcome: tx.status.Failure === undefined ? { ok: true } : { ok: false, error: failureText(tx.status.Failure) },
    transfers: tx.receipts_outcome.flatMap(({ outcome }) => outcome.logs.flatMap((log) => transfersIn(outcome.executor_id, log))),
  };
}

/** The panic message of a failed transaction, or its raw failure. */
function failureText(failure: unknown): string {
  const kind = (failure as { ActionError?: { kind?: { FunctionCallError?: { ExecutionError?: string } } } }).ActionError?.kind;
  return kind?.FunctionCallError?.ExecutionError ?? JSON.stringify(failure);
}

/** NEP-141 transfers in a log line: the standard event (USDC on mainnet) or the older plain line (wrap.testnet). */
function transfersIn(token: string, log: string): ExecuteCheck["transfers"] {
  if (log.startsWith("EVENT_JSON:")) {
    const e = JSON.parse(log.slice("EVENT_JSON:".length)) as { standard?: string; event?: string; data?: { old_owner_id: string; new_owner_id: string; amount: string }[] };
    if (e.standard !== "nep141" || e.event !== "ft_transfer") return [];
    return (e.data ?? []).map((d) => ({ token, from: d.old_owner_id, to: d.new_owner_id, amount: d.amount }));
  }
  const m = /^Transfer (\d+) from (\S+) to (\S+)$/.exec(log);
  return m ? [{ token, from: m[2]!, to: m[3]!, amount: m[1]! }] : [];
}
