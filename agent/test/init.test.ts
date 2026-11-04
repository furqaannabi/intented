import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { unbase58 } from "../../api/src/oneclick.js";
import { initAgent, loadAgentKey } from "../src/init.js";

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "intented-init-"));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

const webUrl = "http://localhost:3000";

/** Signs with the saved private key and verifies with the public key, as the chain would. */
function keysMatch(privateKey: string, publicKey: string): boolean {
  const secret = unbase58(privateKey.replace(/^ed25519:/, ""));
  const pub = unbase58(publicKey.replace(/^ed25519:/, ""));
  const signer = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), secret.subarray(0, 32)]), format: "der", type: "pkcs8" });
  const verifier = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), pub]), format: "der", type: "spki" });
  const message = Buffer.from("intented");
  return secret.length === 64 && secret.subarray(32).equals(pub) && verify(null, message, verifier, sign(null, message, signer));
}

describe("initAgent", () => {
  it("saves a NEAR key pair whose public half is the one in the Create link", () => {
    const r = initAgent({ name: "my-agent", home, webUrl });
    const saved = JSON.parse(readFileSync(r.path, "utf8"));

    expect(r.walletId).toBe("my-agent.intented.testnet");
    expect(saved).toMatchObject({ account_id: "my-agent.intented.testnet", public_key: r.publicKey });
    expect(keysMatch(saved.private_key, r.publicKey)).toBe(true);
    expect(r.link).toBe(`${webUrl}/create?name=my-agent&key=${encodeURIComponent(r.publicKey)}`);
  });

  it("never replaces a saved key: a second run gives back the same key and link", () => {
    const first = initAgent({ name: "my-agent", home, webUrl });
    const before = readFileSync(first.path, "utf8");
    const second = initAgent({ name: "my-agent", home, webUrl });

    expect(readFileSync(first.path, "utf8")).toBe(before);
    expect(second).toMatchObject({ publicKey: first.publicKey, link: first.link, created: false });
    expect(first.created).toBe(true);
  });

  it("refuses a name the factory can't create, and writes nothing", () => {
    for (const name of ["My-Agent", "a.b", "../escape", "-agent", "agent_", "", "a".repeat(64 - "intented.testnet".length)]) {
      expect(() => initAgent({ name, home, webUrl }), name).toThrow(/name/);
    }
    expect(readdirSync(home)).toEqual([]);
  });

  it("takes the longest name that fits in a 64-character account id", () => {
    const name = "a".repeat(64 - ".intented.testnet".length);
    expect(initAgent({ name, home, webUrl }).walletId).toHaveLength(64);
  });

  it("loads the saved key for the wallet it was made for", () => {
    const r = initAgent({ name: "my-agent", home, webUrl });
    const k = loadAgentKey({ walletId: r.walletId, home });
    expect(k.publicKey).toBe(r.publicKey);
    expect(keysMatch(k.privateKey, r.publicKey)).toBe(true);
  });

  it("refuses to load a key that's missing, readable by others, or doesn't match its public key", () => {
    expect(() => loadAgentKey({ walletId: "nobody.intented.testnet", home })).toThrow(/intented init nobody/);

    const r = initAgent({ name: "my-agent", home, webUrl });
    chmodSync(r.path, 0o644);
    expect(() => loadAgentKey({ walletId: r.walletId, home })).toThrow(/readable by others/);
    chmodSync(r.path, 0o600);

    const other = initAgent({ name: "other", home, webUrl });
    const saved = JSON.parse(readFileSync(r.path, "utf8"));
    writeFileSync(r.path, JSON.stringify({ ...saved, public_key: other.publicKey }));
    expect(() => loadAgentKey({ walletId: r.walletId, home })).toThrow(/doesn't match/);
  });

  it("keeps the key file readable by this user only", () => {
    const r = initAgent({ name: "my-agent", home, webUrl });
    expect(statSync(r.path).mode & 0o777).toBe(0o600);
    expect(statSync(join(home, "testnet")).mode & 0o777).toBe(0o700);
  });
});
