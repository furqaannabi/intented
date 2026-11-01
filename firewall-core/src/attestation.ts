// The attestation checker: verifies NEAR AI's report for a model TEE off-chain,
// so the owner can allowlist its signer. Follows nearai-cloud-verifier's checks,
// but every check must pass (the reference only prints some of them).

import { createHash, createPublicKey, verify as cryptoVerify, type JsonWebKey } from "node:crypto";
import { js_verify } from "@phala/dcap-qvl-node";

const HEX = /^[0-9a-f]*$/;

/**
 * TDX report_data binds the signer and our nonce: bytes 0..32 are the
 * Ethereum signing address right-padded with zeros, bytes 32..64 the raw nonce.
 * `reportDataHex` must come from a verified quote, never from the report JSON.
 */
export function reportDataBinds(reportDataHex: string, signingAddress: string, nonceHex: string): boolean {
  const rd = reportDataHex.toLowerCase().replace(/^0x/, "");
  const addr = signingAddress.toLowerCase().replace(/^0x/, "");
  const nonce = nonceHex.toLowerCase();
  if (rd.length !== 128 || addr.length !== 40 || nonce.length !== 64) return false;
  if (!HEX.test(rd) || !HEX.test(addr) || !HEX.test(nonce)) return false;
  return rd === addr + "00".repeat(12) + nonce;
}

export interface VerifiedQuote {
  status: string;
  reportData: string;
  mrConfigId: string;
}

/**
 * Verifies a TDX quote against Intel's certificate chain and TCB info
 * (`collateral`, from Intel's PCS) at `nowS`. Throws unless the quote verifies
 * with status UpToDate, or OutOfDate when `allowOutOfDate` is set: OutOfDate
 * quotes still verify, but the platform is behind Intel's security advisories.
 */
export function verifyTdxQuote(quoteHex: string, collateral: unknown, nowS: number, allowOutOfDate = false): VerifiedQuote {
  // js_verify throws on a bad signature, chain or expired collateral.
  const result = js_verify(Buffer.from(quoteHex, "hex"), collateral, BigInt(nowS)) as {
    status?: string;
    report?: { TD10?: { report_data?: string; mr_config_id?: string } };
  };
  const status = result.status ?? "";
  const ok = status === "UpToDate" || (allowOutOfDate && status === "OutOfDate");
  if (!ok) throw new Error(`TDX quote status is ${status || "missing"}`);
  const td = result.report?.TD10;
  if (!td?.report_data || !td.mr_config_id) throw new Error("verified quote has no TD10 report");
  return { status, reportData: td.report_data, mrConfigId: td.mr_config_id };
}

/**
 * The verified quote measures the app: mr_config_id (48 bytes) is the tag 01,
 * then sha256(app_compose), then zeros. `mrConfigId` must come from a verified quote.
 */
export function composeBound(mrConfigId: string, appCompose: string): boolean {
  const expected = "01" + createHash("sha256").update(appCompose, "utf8").digest("hex");
  return mrConfigId.toLowerCase() === expected.padEnd(96, "0");
}

export const NRAS_ISSUER = "https://nras.attestation.nvidia.com";

export interface Jwks {
  keys: (JsonWebKey & { kid?: string })[];
}

function decodeJson(part: string): Record<string, unknown> {
  const v = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("token part is not a JSON object");
  return v;
}

/**
 * Verifies NVIDIA NRAS's overall attestation token: ES384 only, signed by a key
 * in NVIDIA's JWKS, issued by NRAS, for our nonce, not expired, and with an
 * overall result of exactly `true`. Throws otherwise.
 */
export function verifyNrasToken(jwt: string, jwks: Jwks, nonceHex: string, nowS: number): void {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("NRAS token is not a JWS");
  const [h, p, sig] = parts as [string, string, string];
  const header = decodeJson(h);
  if (header.alg !== "ES384") throw new Error(`NRAS token alg is ${String(header.alg)}, not ES384`);
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("NRAS token key is not in NVIDIA's JWKS");
  const { kid: _kid, alg: _alg, x5c: _x5c, ...publicJwk } = jwk as JsonWebKey & Record<string, unknown>;
  const key = createPublicKey({ key: publicJwk as JsonWebKey, format: "jwk" });
  const ok = cryptoVerify("sha384", Buffer.from(`${h}.${p}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url"));
  if (!ok) throw new Error("NRAS token signature does not verify");

  const claims = decodeJson(p);
  if (claims.iss !== NRAS_ISSUER) throw new Error("NRAS token issuer is not NRAS");
  if (String(claims.eat_nonce).toLowerCase() !== nonceHex.toLowerCase()) throw new Error("NRAS token is for another nonce");
  if (typeof claims.exp !== "number" || nowS >= claims.exp) throw new Error("NRAS token has expired");
  if (claims["x-nvidia-overall-att-result"] !== true) throw new Error("NRAS overall attestation result is not true");
}

export interface ModelAttestation {
  model_name: string;
  signing_address: string;
  signing_algo: string;
  request_nonce: string;
  intel_quote: string;
  nvidia_payload: string;
  info: { tcb_info: { app_compose: string } | string };
}

export interface AttestationDeps {
  collateral: (quote: Buffer) => Promise<unknown>;
  nras: (payload: string) => Promise<string>;
  jwks: () => Promise<Jwks>;
  nowS: number;
}

export interface VerifiedSigner {
  model: string;
  signing_address: string;
  tdx_status: string;
  compose_sha256: string;
}

/**
 * Every check for one model TEE, in order; throws on the first that fails.
 * Only a signer returned from here may be registered with `register_signer`.
 */
export async function verifyModelAttestation(
  a: ModelAttestation,
  expected: { model: string; nonce: string },
  deps: AttestationDeps,
): Promise<VerifiedSigner> {
  if (a.model_name !== expected.model) throw new Error(`attestation is for model ${a.model_name}, not ${expected.model}`);
  if (a.request_nonce.toLowerCase() !== expected.nonce.toLowerCase()) throw new Error("attestation does not echo our nonce");
  if (a.signing_algo !== "ecdsa") throw new Error(`signing_algo is ${a.signing_algo}, not ecdsa`);

  const quote = Buffer.from(a.intel_quote, "hex");
  const q = verifyTdxQuote(a.intel_quote, await deps.collateral(quote), deps.nowS);
  if (!reportDataBinds(q.reportData, a.signing_address, expected.nonce)) {
    throw new Error("verified report_data does not bind this signer and our nonce");
  }

  const tcb = typeof a.info.tcb_info === "string" ? JSON.parse(a.info.tcb_info) : a.info.tcb_info;
  if (typeof tcb.app_compose !== "string" || !composeBound(q.mrConfigId, tcb.app_compose)) {
    throw new Error("verified mr_config_id does not bind the attested app_compose");
  }

  const gpu = JSON.parse(a.nvidia_payload) as { nonce?: string };
  if (String(gpu.nonce).toLowerCase() !== expected.nonce.toLowerCase()) throw new Error("GPU evidence is for another nonce");
  verifyNrasToken(await deps.nras(a.nvidia_payload), await deps.jwks(), expected.nonce, deps.nowS);

  return {
    model: a.model_name,
    signing_address: a.signing_address.toLowerCase(),
    tdx_status: q.status,
    compose_sha256: createHash("sha256").update(tcb.app_compose, "utf8").digest("hex"),
  };
}
