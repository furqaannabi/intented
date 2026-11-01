// The attestation checker. Fetches NEAR AI's attestation report for the model
// with a fresh nonce, verifies every model TEE in it off-chain (TDX quote
// against Intel's chain, report_data binding signer and nonce, mr_config_id
// binding the app, GPU evidence through NVIDIA NRAS with its token signature
// checked), and with --register allowlists each verified signer on the wallet.
//
// Usage: pnpm attest [--register]
// Reads NEAR_AI_API_KEY, NEAR_AI_MODEL, CONTRACT_ACCOUNT_ID and OWNER_ACCOUNT_ID from ../.env.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { js_get_collateral } from "@phala/dcap-qvl-node";
import { NRAS_ISSUER, verifyModelAttestation, type Jwks, type ModelAttestation, type VerifiedSigner } from "../src/attestation.js";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, "..", "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const { NEAR_AI_API_KEY: KEY, NEAR_AI_MODEL: MODEL, CONTRACT_ACCOUNT_ID: WALLET, OWNER_ACCOUNT_ID: OWNER } = process.env;
const BASE = process.env.NEAR_AI_BASE_URL || "https://cloud-api.near.ai";
const NETWORK = process.env.NEAR_NETWORK || "testnet";
const PCS = "https://api.trustedservices.intel.com/tdx/certification/v4";
if (!KEY || !MODEL) throw new Error("NEAR_AI_API_KEY and NEAR_AI_MODEL must be set");
const register = process.argv.includes("--register");
if (register && (!WALLET || !OWNER)) throw new Error("--register needs CONTRACT_ACCOUNT_ID and OWNER_ACCOUNT_ID");

async function json(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`${url.split("?")[0]} -> ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

const nonce = randomBytes(32).toString("hex");
const report = await json(`${BASE}/v1/attestation/report?${new URLSearchParams({ model: MODEL, signing_algo: "ecdsa", nonce })}`, {
  headers: { accept: "application/json", Authorization: `Bearer ${KEY}` },
});
const attestations: ModelAttestation[] = report.model_attestations ?? [];
if (attestations.length === 0) throw new Error("report has no model attestations");

const deps = {
  collateral: (quote: Buffer) => js_get_collateral(PCS, quote),
  nras: async (payload: string) => {
    const body = await json(`${NRAS_ISSUER}/v3/attest/gpu`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: payload,
    });
    if (!Array.isArray(body) || body[0]?.[0] !== "JWT" || typeof body[0][1] !== "string") throw new Error("unexpected NRAS response");
    return body[0][1] as string;
  },
  jwks: () => json(`${NRAS_ISSUER}/.well-known/jwks.json`) as Promise<Jwks>,
  nowS: Math.floor(Date.now() / 1000),
};

// Every model TEE must verify; one failure means nothing is registered.
const verified: VerifiedSigner[] = [];
for (const [i, a] of attestations.entries()) {
  try {
    verified.push(await verifyModelAttestation(a, { model: MODEL, nonce }, deps));
  } catch (e) {
    console.error(`model TEE ${i + 1}/${attestations.length} (${a.signing_address}): FAIL ${(e as Error).message}`);
    process.exit(1);
  }
}

const out = join(here, "..", "artifacts", "attestation");
mkdirSync(out, { recursive: true });
const summary = { checked_at: new Date().toISOString(), model: MODEL, nonce, verified };
writeFileSync(join(out, `${summary.checked_at.replace(/[:.]/g, "-")}.json`), JSON.stringify({ ...summary, report }, null, 2));
for (const v of verified) {
  console.log(`VERIFIED ${v.signing_address}: TDX ${v.tdx_status}, report_data binds signer and nonce, app compose ${v.compose_sha256.slice(0, 16)}…, NVIDIA GPU attestation true`);
}

if (register) {
  for (const v of verified) {
    execFileSync(
      "near",
      ["contract", "call-function", "as-transaction", WALLET!, "register_signer", "json-args", JSON.stringify({ eth_address: v.signing_address }),
        "prepaid-gas", "30 Tgas", "attached-deposit", "0 NEAR", "sign-as", OWNER!, "network-config", NETWORK, "sign-with-keychain", "send"],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    console.log(`registered ${v.signing_address} on ${WALLET}`);
  }
} else {
  console.log("not registered (pass --register to allowlist on the wallet)");
}
