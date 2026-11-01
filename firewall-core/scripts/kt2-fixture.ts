// Writes contract/kt2-verify/tests/fixture.json: signatures made by ethers
// (an implementation independent of the contract) over the NEAR AI signed-text
// format, so the contract's EIP-191 + ecrecover path is checked against it.
//
// The keys are throwaway test keys derived from fixed strings. They hold nothing.
//
// Usage: pnpm tsx scripts/kt2-fixture.ts

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Wallet, keccak256, toUtf8Bytes } from "ethers";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "..", "contract", "kt2-verify", "tests", "fixture.json");

const signer = new Wallet(keccak256(toUtf8Bytes("intented-kt2-test-signer")));
const stranger = new Wallet(keccak256(toUtf8Bytes("intented-kt2-test-stranger")));

const model = "test-org/test-model";
const req = Buffer.from(JSON.stringify({ model, stream: false, messages: [{ role: "user", content: "pay vendor.testnet" }] }));
const resp = Buffer.from(
  JSON.stringify({ id: "chatcmpl-test", choices: [{ message: { content: '{"verdict":"ALLOW","reason":"fits — ✓","action":"INTENTED_V1|vendør.testnet"}' } }] }),
);

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const text = `${model}:${sha(req)}:${sha(resp)}`;

const fixture = {
  model,
  request_b64: req.toString("base64"),
  response_b64: resp.toString("base64"),
  signed_text: text,
  signer: signer.address.toLowerCase(),
  signature: await signer.signMessage(text),
  stranger: stranger.address.toLowerCase(),
  stranger_signature: await stranger.signMessage(text),
  other_model_signature: await signer.signMessage(`other-org/other-model:${sha(req)}:${sha(resp)}`),
  gateway_text: `${sha(req)}:${sha(resp)}`,
  gateway_signature: await signer.signMessage(`${sha(req)}:${sha(resp)}`),
};

writeFileSync(out, JSON.stringify(fixture, null, 2) + "\n");
console.log(`wrote ${out}`);
