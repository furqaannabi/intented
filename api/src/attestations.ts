// Maps each signer to its published attestation report, the files
// `pnpm attest --register` writes to docs/attestations/<signer>.json.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadAttestationUrls(dir: string, baseUrl: string): Record<string, string> {
  const urls: Record<string, string> = {};
  if (!existsSync(dir)) return urls;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    let report: { signing_address?: unknown };
    try {
      report = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch {
      continue;
    }
    // The file name is the address the report was checked for; anything else is not this signer's report.
    const signer = typeof report.signing_address === "string" ? report.signing_address.toLowerCase() : null;
    if (!signer || file.toLowerCase() !== `${signer}.json`) continue;
    urls[signer] = `${baseUrl}/${file}`;
  }
  return urls;
}
