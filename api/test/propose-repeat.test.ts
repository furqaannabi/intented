import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openStore } from "../src/store.js";

const TOKEN = "agent-token";

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
  const body = (nonce: string, amount = "1000000000000000000000") => {
    const args = JSON.stringify({ receiver_id: "intented-vendor.testnet", amount, memo: "market data" });
    const action = {
      receiver_id: "wrap.testnet",
      method: "ft_transfer",
      args_sha256: createHash("sha256").update(args, "utf8").digest("hex"),
      deposit: "1",
      nonce,
      expiry_ms: String(Date.now() + 10 * 60_000),
    };
    return { mandate_id, action, args, context: "402 from the paywall" };
  };
  const propose = (b: object) =>
    a.request("/api/propose", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(b) });
  return { propose, body, started };
}

describe("POST /api/propose sent twice with the same nonce", () => {
  it("returns the first proposal for an identical retry, and runs the pipeline once", async () => {
    const { propose, body, started } = setup();
    const b = body("1700000000000");
    const first = await (await propose(b)).json();
    const again = await propose(b);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(first);
    expect(started).toEqual([first.proposal_id]);
  });

  it("refuses a different action that reuses the nonce, since the wallet would refuse it", async () => {
    const { propose, body, started } = setup();
    await propose(body("1700000000000"));
    const res = await propose(body("1700000000000", "2000000000000000000000"));
    expect(res.status).toBe(409);
    expect(started).toHaveLength(1);
  });

  it("stores a proposal with a new nonce as a new payment", async () => {
    const { propose, body, started } = setup();
    await propose(body("1700000000000"));
    expect((await propose(body("1700000000001"))).status).toBe(200);
    expect(started).toHaveLength(2);
  });
});
