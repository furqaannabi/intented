// The agent's command line.
//
// Usage: pnpm intented init <name>
//   Makes the agent's key pair for <name>.intented.testnet, saves it in ~/.intented/testnet/,
//   and prints the Create page link that registers its public half. It never prints the private key.
//   INTENTED_HOME and INTENTED_WEB_URL override where keys are kept and which web app the link opens.

import { homedir } from "node:os";
import { join } from "node:path";
import { initAgent } from "./init.js";

const [command, name] = process.argv.slice(2);

if (command !== "init" || !name) {
  console.error("usage: pnpm intented init <name>");
  process.exit(2);
}

try {
  const r = initAgent({
    name,
    home: process.env.INTENTED_HOME || join(homedir(), ".intented"),
    webUrl: (process.env.INTENTED_WEB_URL || "http://localhost:3000").replace(/\/+$/, ""),
  });
  console.log(r.created ? `Made the agent's key for ${r.walletId}.` : `A key for ${r.walletId} is already saved; using it, unchanged.`);
  console.log(`  private key: ${r.path} (readable by you only; never share it or commit it)`);
  console.log(`  public key:  ${r.publicKey}`);
  console.log("");
  console.log("Open this link to create the wallet with this agent's key, or paste the public key into Add agent key on an existing wallet:");
  console.log(`  ${r.link}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
