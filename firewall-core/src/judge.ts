// judge: one verdict from NEAR AI Cloud, with the exact request and response
// bytes and the TEE signature over them, fetched straight after the call
// (signing keys rotate). The wallet contract re-checks all of it on-chain.

import { createHash } from "node:crypto";
import { verifyMessage } from "ethers";
import { canonicalBytes, type Action } from "./canonical.js";
import { buildJudgeRequest } from "./prompt.js";
import type { Network } from "./tokens.js";
import { parseVerdict } from "./verdict.js";

export interface JudgeConfig {
  apiKey: string;
  model: string;
  network: Network;
  baseUrl?: string;
  /** Injected for tests. */
  fetch?: typeof fetch;
}

export interface Judgement {
  verdict: "ALLOW" | "DENY";
  reason: string;
  model: string;
  chat_id: string;
  req_bytes: Uint8Array;
  resp_bytes: Uint8Array;
  /** 65-byte ECDSA signature, hex. */
  signature: string;
  /** The address the signature recovers to, lowercase. */
  signer: string;
}

const sha256Hex = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

export function createJudge(cfg: JudgeConfig) {
  const base = cfg.baseUrl || "https://cloud-api.near.ai";
  const http = cfg.fetch ?? fetch;
  const auth = { Authorization: `Bearer ${cfg.apiKey}` };

  async function signatureFor(chatId: string): Promise<{ text: string; signature: string; signing_address: string }> {
    const url = `${base}/v1/signature/${encodeURIComponent(chatId)}?model=${encodeURIComponent(cfg.model)}&signing_algo=ecdsa`;
    // The signature is cached on the node that served the call; another node may 404 briefly.
    for (let attempt = 1; ; attempt++) {
      const res = await http(url, { headers: { accept: "application/json", ...auth } });
      if (res.ok) {
        const body = await res.json();
        if (body.error_code) throw new Error(`signature unavailable: ${body.error_code}`);
        return body;
      }
      if (res.status !== 404 || attempt === 5) throw new Error(`signature fetch failed: ${res.status}`);
      await new Promise((ok) => setTimeout(ok, 1000));
    }
  }

  return async function judge(mandateText: string, action: Action, argsJson: string, context: string): Promise<Judgement> {
    const reqBytes = new TextEncoder().encode(
      JSON.stringify(buildJudgeRequest({ model: cfg.model, network: cfg.network, mandate: mandateText, action, argsJson, context })),
    );
    const res = await http(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "accept-encoding": "identity", ...auth },
      body: reqBytes,
    });
    const respBytes = new Uint8Array(await res.arrayBuffer());
    if (!res.ok) throw new Error(`chat/completions failed: ${res.status}`);
    const chat = JSON.parse(new TextDecoder().decode(respBytes));

    const sig = await signatureFor(chat.id);
    if (sig.text !== `${cfg.model}:${sha256Hex(reqBytes)}:${sha256Hex(respBytes)}`) {
      throw new Error("signed text does not cover this request and response");
    }
    const signer = verifyMessage(sig.text, sig.signature).toLowerCase();
    if (signer !== String(sig.signing_address).toLowerCase()) throw new Error("signature does not recover to the signing_address");

    const { verdict, reason } = parseVerdict(chat.choices?.[0]?.message?.content ?? "", new TextDecoder().decode(canonicalBytes(action)));
    return { verdict, reason, model: cfg.model, chat_id: chat.id, req_bytes: reqBytes, resp_bytes: respBytes, signature: sig.signature, signer };
  };
}
