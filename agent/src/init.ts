// intented init: makes the agent's key pair on the machine the agent runs on.
// The private half stays in a file only this user can read, outside any
// project folder; only the public half leaves, in a link to the Create page,
// where the owner registers it as a key that can call propose and execute only.

import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { base58 } from "../../api/src/oneclick.js";

export const FACTORY_ID = "intented.testnet";

export interface InitOptions {
  /** The wallet's name: it becomes <name>.intented.testnet. */
  name: string;
  /** Where keys are kept; ~/.intented on a real machine. */
  home: string;
  /** The web app the link points at. */
  webUrl: string;
}

export interface InitResult {
  walletId: string;
  /** The file holding the private key. */
  path: string;
  publicKey: string;
  /** The Create page with the name and the public key filled in. */
  link: string;
  /** false when a key was already saved for this wallet and was given back unchanged. */
  created: boolean;
}

/** A fresh ed25519 key pair in NEAR's text form: the private key is the seed followed by the public key. */
function newKeyPair(): { publicKey: string; privateKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const seed = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32);
  const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return { publicKey: `ed25519:${base58(pub)}`, privateKey: `ed25519:${base58(Buffer.concat([seed, pub]))}` };
}

/** A label the factory accepts: lowercase letters and digits, joined by single - or _. The same rule as the Create page. */
const LABEL = /^(?:[a-z\d]+[-_])*[a-z\d]+$/;

export function initAgent({ name, home, webUrl }: InitOptions): InitResult {
  const walletId = `${name}.${FACTORY_ID}`;
  // Checked before anything touches the disk: the name is also part of the key file's path.
  if (!LABEL.test(name)) throw new Error(`"${name}" isn't a wallet name the factory can create: use lowercase letters and digits, joined by - or _`);
  if (walletId.length > 64) throw new Error(`the name is too long: ${walletId} is over NEAR's 64 characters`);
  const dir = join(home, "testnet");
  const path = join(dir, `${walletId}.json`);
  const linkFor = (publicKey: string) => `${webUrl}/create?name=${encodeURIComponent(name)}&key=${encodeURIComponent(publicKey)}`;
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  const keys = newKeyPair();
  try {
    // "wx": never replace a saved key. It may already be on a wallet, and it's the only copy.
    // The same fields near-cli keeps in ~/.near-credentials, so either tool can read it.
    writeFileSync(path, `${JSON.stringify({ account_id: walletId, public_key: keys.publicKey, private_key: keys.privateKey }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    const saved = JSON.parse(readFileSync(path, "utf8")) as { public_key?: unknown };
    if (typeof saved.public_key !== "string") throw new Error(`${path} exists but has no public_key; move it away to make a new key`);
    return { walletId, path, publicKey: saved.public_key, link: linkFor(saved.public_key), created: false };
  }
  return { walletId, path, publicKey: keys.publicKey, link: linkFor(keys.publicKey), created: true };
}
