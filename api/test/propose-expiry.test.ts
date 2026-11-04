import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openStore } from "../src/store.js";

const TOKEN = "agent-token";
const MINUTE = 60_000;

function setup() {
  const started: string[] = [];
  const store = openStore(":memory:");
  const a = createApp({
    store,
    network: "testnet",
    model: "Qwen/Qwen3.8-27B",
    agentToken: TOKEN,
    startPipeline: (id) => started.push(id),
    attestationUrls: {},
    redteam: () => null,
  });
  const mandate_id = store.createMandate("Buy market data from intented-vendor.testnet only.", "0".repeat(64)).id;
  const propose = (expiresIn: number) => {
    const args = JSON.stringify({ receiver_id: "intented-vendor.testnet", amount: "1000000000000000000000", memo: "market data" });
    const action = {
      receiver_id: "wrap.testnet",
      method: "ft_transfer",
      args_sha256: createHash("sha256").update(args, "utf8").digest("hex"),
      deposit: "1",
      nonce: String(Date.now()),
      expiry_ms: String(Date.now() + expiresIn),
    };
    return a.request("/api/propose", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ mandate_id, action, args, context: "402 from the paywall" }),
    });
  };
  return { propose, started };
}

describe("POST /api/propose and the wallet's one-hour expiry bound", () => {
  it("refuses an action that expires more than an hour ahead, before any NEAR AI call", async () => {
    const { propose, started } = setup();
    const res = await propose(61 * MINUTE);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/hour/);
    expect(started).toEqual([]);
  });

  it("accepts an action that expires well inside the hour", async () => {
    const { propose, started } = setup();
    expect((await propose(15 * MINUTE)).status).toBe(200);
    expect(started).toHaveLength(1);
  });
});
