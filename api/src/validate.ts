// Checks on a proposal POST /api/verdict reads from the chain, so nothing is judged that the
// wallet would refuse for its form alone (decision 5 of the pipeline record).

import { createHash } from "node:crypto";
import { buildJudgeRequest, type Action, type Network } from "@intented/firewall-core";
import type { ActionJson } from "./store.js";

/** The pipeline takes about 10 s; an action that expires inside it would be refused on-chain. */
export const MIN_EXPIRY_HEADROOM_MS = 60_000;
/** The wallet's propose refuses an expiry more than an hour past its block time; a minute less here allows for clock drift. */
export const MAX_EXPIRY_AHEAD_MS = 3_600_000 - 60_000;
const MAX_CONTEXT_CHARS = 20_000;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
const ACTION_FIELDS = ["receiver_id", "method", "args_sha256", "deposit", "nonce", "expiry_ms"] as const;

export type ProposeInput = { mandate_id: string; action: ActionJson; args: string; context: string };

/** The firewall core's action, with the u64 fields as bigints. */
export function toAction(a: ActionJson): Action {
  return { ...a, nonce: BigInt(a.nonce), expiry_ms: BigInt(a.expiry_ms) };
}

/** The input, or the reason it is refused. */
export function checkPropose(body: unknown, opts: { network: Network; model: string; now: number }): ProposeInput | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "body must be a JSON object" };
  const { mandate_id, action, args, context } = body as Record<string, unknown>;
  if (typeof mandate_id !== "string") return { error: "mandate_id must be a string" };
  if (typeof args !== "string") return { error: "args must be the exact JSON string the wallet will send" };
  if (typeof context !== "string") return { error: "context must be a string (it may be empty)" };
  if (context.length > MAX_CONTEXT_CHARS) return { error: `context is over ${MAX_CONTEXT_CHARS} characters` };
  if (typeof action !== "object" || action === null) return { error: "action must be an object" };
  const a = action as Record<string, unknown>;
  for (const f of ACTION_FIELDS) if (typeof a[f] !== "string") return { error: `action.${f} must be a string` };
  const act = Object.fromEntries(ACTION_FIELDS.map((f) => [f, a[f]])) as unknown as ActionJson;
  for (const f of ["nonce", "expiry_ms", "deposit"] as const) if (!DECIMAL.test(act[f])) return { error: `action.${f} must be a decimal string` };

  try {
    JSON.parse(args);
  } catch {
    return { error: "args is not valid JSON" };
  }
  if (createHash("sha256").update(args, "utf8").digest("hex") !== act.args_sha256) return { error: "args do not hash to action.args_sha256" };
  if (BigInt(act.expiry_ms) < BigInt(opts.now + MIN_EXPIRY_HEADROOM_MS)) return { error: `action expires in under ${MIN_EXPIRY_HEADROOM_MS / 1000} s` };
  if (BigInt(act.expiry_ms) > BigInt(opts.now + MAX_EXPIRY_AHEAD_MS)) {
    return { error: "action expires more than an hour ahead, which the wallet refuses (the limit here is 59 minutes, for clock drift)" };
  }

  // Everything else the firewall core checks: account ids, method, u64 and u128 ranges, a token transfer's amount.
  try {
    buildJudgeRequest({ model: opts.model, network: opts.network, mandate: "", action: toAction(act), argsJson: args, context });
  } catch (e) {
    return { error: `action rejected by the firewall core: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { mandate_id, action: act, args, context };
}
