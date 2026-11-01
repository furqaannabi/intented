// Writes test/fixtures/tdx.json from a saved NEAR AI attestation report: the
// model TEE's TDX quote, signer, nonce and app_compose, plus Intel's collateral
// for the quote and the time it was fetched, so the TDX checks run offline.
//
// Usage: pnpm tsx scripts/attestation-fixture.ts artifacts/kt1/latest/attestation.json

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { js_get_collateral } from "@phala/dcap-qvl-node";

const report = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
const a = report.model_attestations[0];
const quote = Buffer.from(a.intel_quote, "hex");
const collateral = await js_get_collateral("https://api.trustedservices.intel.com/tdx/certification/v4", quote);

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures", "tdx.json");
writeFileSync(
  out,
  JSON.stringify(
    {
      model_name: a.model_name,
      signing_address: a.signing_address,
      request_nonce: a.request_nonce,
      intel_quote: a.intel_quote,
      app_compose: typeof a.info.tcb_info === "string" ? JSON.parse(a.info.tcb_info).app_compose : a.info.tcb_info.app_compose,
      collateral,
      fetched_at_s: Math.floor(Date.now() / 1000),
    },
    null,
    1,
  ) + "\n",
);
console.log(`wrote ${out}`);
