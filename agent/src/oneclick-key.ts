// Creates the 1Click stand-in's quote-signing key once, straight into ../.env,
// and prints only its public half. Testnet only; the key never leaves .env.
//
// Usage: pnpm oneclick-key

import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { base58 } from "../../api/src/oneclick.js";
import { standInKey } from "./oneclick-standin.js";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env");
const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const existing = env.match(/^ONECLICK_STANDIN_KEY=(.+)$/m)?.[1];
if (existing) {
  console.log(`ONECLICK_STANDIN_KEY is already in .env; its public key is ${standInKey(existing.trim()).publicKey}`);
} else {
  const seed = `ed25519:${base58(randomBytes(32))}`;
  const pub = standInKey(seed).publicKey;
  appendFileSync(envPath, `${env && !env.endsWith("\n") ? "\n" : ""}ONECLICK_STANDIN_KEY=${seed}\nONECLICK_STANDIN_PUBLIC_KEY=${pub}\n`);
  console.log(`wrote ONECLICK_STANDIN_KEY and ONECLICK_STANDIN_PUBLIC_KEY to .env; public key ${pub}`);
}
