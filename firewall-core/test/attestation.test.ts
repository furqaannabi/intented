import { describe, expect, it } from "vitest";
import { reportDataBinds } from "../src/attestation.js";

const addr = "0x3b753b4406613c5e70ae640508632b600424fa0c";
const nonce = "29".repeat(32);
// report_data = signing address right-padded to 32 bytes, then the raw 32-byte nonce.
const reportData = addr.slice(2) + "00".repeat(12) + nonce;

describe("reportDataBinds", () => {
  it("accepts report_data that binds this signer and this nonce", () => {
    expect(reportDataBinds(reportData, addr, nonce)).toBe(true);
    expect(reportDataBinds(reportData.toUpperCase(), addr.toUpperCase().replace("0X", "0x"), nonce)).toBe(true);
  });

  it.each([
    ["another signer", reportData, "0x" + "11".repeat(20), nonce],
    ["another nonce", reportData, addr, "30".repeat(32)],
    ["non-zero padding", addr.slice(2) + "00".repeat(11) + "01" + nonce, addr, nonce],
    ["short report_data", reportData.slice(0, 126), addr, nonce],
    ["short nonce", reportData, addr, nonce.slice(0, 62)],
    ["non-hex", "zz" + reportData.slice(2), addr, nonce],
  ])("rejects %s", (_, rd, a, n) => {
    expect(reportDataBinds(rd, a, n)).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { verifyTdxQuote } from "../src/attestation.js";

// A real NEAR AI model TEE quote with Intel's collateral, saved by scripts/attestation-fixture.ts.
const tdx = JSON.parse(readFileSync(new URL("./fixtures/tdx.json", import.meta.url), "utf8"));
const flip = (hex: string, at: number) => hex.slice(0, at) + (hex[at] === "0" ? "1" : "0") + hex.slice(at + 1);

describe("verifyTdxQuote", () => {
  it("verifies a real quote against Intel's chain, and its report_data binds the signer and nonce", () => {
    const q = verifyTdxQuote(tdx.intel_quote, tdx.collateral, tdx.fetched_at_s);
    expect(q.status).toBe("UpToDate");
    expect(reportDataBinds(q.reportData, tdx.signing_address, tdx.request_nonce)).toBe(true);
  });

  it("rejects a quote with one flipped hex digit in its body or its signature", () => {
    const len = tdx.intel_quote.length;
    for (const at of [48 + 1000, len - 200]) {
      expect(() => verifyTdxQuote(flip(tdx.intel_quote, at), tdx.collateral, tdx.fetched_at_s)).toThrow();
    }
  });

  it("rejects collateral that has expired", () => {
    const twoYears = 2 * 365 * 24 * 3600;
    expect(() => verifyTdxQuote(tdx.intel_quote, tdx.collateral, tdx.fetched_at_s + twoYears)).toThrow();
  });
});

import { composeBound } from "../src/attestation.js";

describe("composeBound", () => {
  const mrConfigId = verifyTdxQuote(tdx.intel_quote, tdx.collateral, tdx.fetched_at_s).mrConfigId;

  it("accepts the app_compose whose sha256 the verified quote's mr_config_id carries", () => {
    expect(composeBound(mrConfigId, tdx.app_compose)).toBe(true);
  });

  it("rejects any other app_compose, or an mr_config_id with a different tag or non-zero tail", () => {
    expect(composeBound(mrConfigId, tdx.app_compose + " ")).toBe(false);
    expect(composeBound("02" + mrConfigId.slice(2), tdx.app_compose)).toBe(false);
    expect(composeBound(mrConfigId.slice(0, -2) + "01", tdx.app_compose)).toBe(false);
    expect(composeBound(mrConfigId.slice(0, 66), tdx.app_compose)).toBe(false);
  });
});

import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { verifyNrasToken } from "../src/attestation.js";

const NRAS_ISS = "https://nras.attestation.nvidia.com";
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

function nvidiaKey(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-384" });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "ES384" } };
}

function token(key: ReturnType<typeof nvidiaKey>, claims: Record<string, unknown>, header: Record<string, unknown> = {}) {
  const input = `${b64url({ alg: "ES384", kid: key.kid, ...header })}.${b64url(claims)}`;
  const sig = cryptoSign("sha384", Buffer.from(input), { key: key.privateKey, dsaEncoding: "ieee-p1363" });
  return `${input}.${sig.toString("base64url")}`;
}

describe("verifyNrasToken", () => {
  const key = nvidiaKey("nv-eat-kid-test");
  const jwks = { keys: [key.jwk] };
  const now = 1_762_000_000;
  const good = { iss: NRAS_ISS, eat_nonce: nonce, "x-nvidia-overall-att-result": true, iat: now - 10, exp: now + 3600 };

  it("accepts NVIDIA's signed token for our nonce with an overall true", () => {
    expect(() => verifyNrasToken(token(key, good), jwks, nonce, now)).not.toThrow();
  });

  it.each([
    ["an overall false", () => token(key, { ...good, "x-nvidia-overall-att-result": false })],
    ["an overall that is the string true", () => token(key, { ...good, "x-nvidia-overall-att-result": "true" })],
    ["another nonce", () => token(key, { ...good, eat_nonce: "30".repeat(32) })],
    ["another issuer", () => token(key, { ...good, iss: "https://evil.example" })],
    ["an expired token", () => token(key, { ...good, exp: now - 1 })],
    ["an unknown key id", () => token(key, good, { kid: "nv-eat-kid-other" })],
    ["alg none", () => token(key, good, { alg: "none" })],
    ["alg HS384", () => token(key, good, { alg: "HS384" })],
    ["a key NVIDIA did not publish", () => token(nvidiaKey("nv-eat-kid-test"), good)],
    ["a tampered payload", () => {
      const [h, , s] = token(key, good).split(".");
      return `${h}.${b64url({ ...good, eat_nonce: nonce, extra: 1 })}.${s}`;
    }],
    ["two parts", () => token(key, good).split(".").slice(0, 2).join(".")],
  ])("rejects %s", (_, make) => {
    expect(() => verifyNrasToken(make(), jwks, nonce, now)).toThrow();
  });
});

import { verifyModelAttestation, type ModelAttestation } from "../src/attestation.js";

describe("verifyModelAttestation", () => {
  const key = nvidiaKey("nv-eat-kid-test");
  const now = tdx.fetched_at_s;
  const nras = (claims: Record<string, unknown> = {}) => async () =>
    token(key, { iss: NRAS_ISS, eat_nonce: tdx.request_nonce, "x-nvidia-overall-att-result": true, exp: now + 3600, ...claims });
  const deps = (over: Partial<Parameters<typeof verifyModelAttestation>[2]> = {}) => ({
    collateral: async () => tdx.collateral,
    nras: nras(),
    jwks: async () => ({ keys: [key.jwk] }),
    nowS: now,
    ...over,
  });
  const att = (over: Partial<ModelAttestation> = {}): ModelAttestation => ({
    model_name: tdx.model_name,
    signing_address: tdx.signing_address,
    signing_algo: "ecdsa",
    request_nonce: tdx.request_nonce,
    intel_quote: tdx.intel_quote,
    nvidia_payload: JSON.stringify({ nonce: tdx.request_nonce, arch: "HOPPER", evidence_list: [] }),
    info: { tcb_info: { app_compose: tdx.app_compose } },
    ...over,
  });

  it("returns the signer when every check passes", async () => {
    const r = await verifyModelAttestation(att(), { model: tdx.model_name, nonce: tdx.request_nonce }, deps());
    expect(r.signing_address).toBe(tdx.signing_address.toLowerCase());
    expect(r.tdx_status).toBe("UpToDate");
    expect(r.compose_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each<[string, Partial<ModelAttestation>, Partial<Parameters<typeof verifyModelAttestation>[2]>, RegExp]>([
    ["another model", { model_name: "other/model" }, {}, /model/],
    ["a nonce not echoed", { request_nonce: "30".repeat(32) }, {}, /nonce/],
    ["an ed25519 signer", { signing_algo: "ed25519" }, {}, /ecdsa/],
    ["a signer the quote does not bind", { signing_address: "0x" + "11".repeat(20) }, {}, /report_data/],
    ["another app_compose", { info: { tcb_info: { app_compose: tdx.app_compose + " " } } }, {}, /compose/],
    ["GPU evidence for another nonce", { nvidia_payload: JSON.stringify({ nonce: "30".repeat(32) }) }, {}, /GPU/],
    ["an NRAS overall false", {}, { nras: nras({ "x-nvidia-overall-att-result": false }) }, /overall/],
  ])("rejects %s", async (_, a, d, why) => {
    await expect(verifyModelAttestation(att(a), { model: tdx.model_name, nonce: tdx.request_nonce }, deps(d))).rejects.toThrow(why);
  });
});
