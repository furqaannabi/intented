// Registers a 1Click deposit address on the token before the wallet pays it.
//
// On mainnet, USDC refuses an ft_transfer to an account it hasn't registered, and every 1Click
// quote has a fresh deposit address. The wallet can't register it (that would be a contract
// change), and the agent's key may only call propose and execute. So a sponsor account pays the
// 0.00125 NEAR registration, signed by the NEAR CLI with the sponsor's key from the keychain:
// no key is read or held here. It touches neither the verdict nor the wallet's checks.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const STORAGE_DEPOSIT = "0.00125 NEAR";

async function isRegistered(rpcUrl: string, token: string, account: string): Promise<boolean> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "storage",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "optimistic",
        account_id: token,
        method_name: "storage_balance_of",
        args_base64: Buffer.from(JSON.stringify({ account_id: account })).toString("base64"),
      },
    }),
  });
  const body = await res.json();
  if (!body.result?.result) throw new Error(`storage_balance_of failed: ${JSON.stringify(body.error ?? body.result?.error)}`);
  return JSON.parse(Buffer.from(body.result.result).toString("utf8")) !== null;
}

/** The near CLI, from PATH or where its installer puts it. */
function runNear(args: string[]): void {
  const installed = join(homedir(), ".cargo", "bin", "near");
  execFileSync(existsSync(installed) ? installed : "near", args, { stdio: "ignore", timeout: 120_000 });
}

export function storageSponsor(o: {
  rpcUrl: string;
  sponsorId: string;
  network: string;
  log: (line: string) => void;
  run?: (args: string[]) => void;
}): (token: string, depositAddress: string) => Promise<void> {
  const run = o.run ?? runNear;
  return async (token, address) => {
    if (await isRegistered(o.rpcUrl, token, address)) return;
    run([
      "contract", "call-function", "as-transaction", token, "storage_deposit",
      "json-args", JSON.stringify({ account_id: address, registration_only: true }),
      "prepaid-gas", "30 Tgas", "attached-deposit", STORAGE_DEPOSIT,
      "sign-as", o.sponsorId, "network-config", o.network, "sign-with-keychain", "send",
    ]);
    if (!(await isRegistered(o.rpcUrl, token, address))) throw new Error(`${address} is still not registered on ${token}`);
    o.log(`registered 1Click's deposit address on ${token} (${STORAGE_DEPOSIT}, paid by ${o.sponsorId})`);
  };
}
