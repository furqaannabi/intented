import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openStore } from "../src/store.js";

// Each test sets its own clock and names its client in a header, so the limit is checked without waiting.
function setup(limit = { perClient: 2, total: 3, windowMs: 60_000 }) {
  let t = 1_000_000;
  const a = createApp({
    store: openStore(":memory:"),
    network: "testnet",
    model: "Qwen/Qwen3.8-27B",
    attestationUrls: {},
    redteam: () => null,
    mandateLimit: limit,
    clientOf: (c) => c.req.header("x-test-client") ?? "unknown",
    now: () => t,
  });
  let n = 0;
  const post = (client: string, text = `Buy market data from intented-vendor.testnet only. (${++n})`) =>
    a.request("/api/mandate", { method: "POST", headers: { "content-type": "application/json", "x-test-client": client }, body: JSON.stringify({ text }) });
  return { post, a, advance: (ms: number) => (t += ms) };
}

describe("POST /api/mandate is rate limited, since anyone can write to it", () => {
  it("refuses a client over its limit with 429 and says when to retry", async () => {
    const { post } = setup();
    expect((await post("a")).status).toBe(200);
    expect((await post("a")).status).toBe(200);
    const res = await post("a");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("counts each client apart", async () => {
    const { post } = setup();
    await post("a");
    await post("a");
    expect((await post("b")).status).toBe(200);
  });

  it("caps everyone together, so many addresses can't fill the database either", async () => {
    const { post } = setup();
    await post("a");
    await post("b");
    await post("c");
    expect((await post("d")).status).toBe(429);
  });

  it("lets a client in again once the window has passed", async () => {
    const { post, advance } = setup();
    await post("a");
    await post("a");
    advance(60_000);
    expect((await post("a")).status).toBe(200);
  });

  it("doesn't count a refused request against the limit", async () => {
    const { post } = setup();
    await post("a", "");
    await post("a", "");
    expect((await post("a")).status).toBe(200);
  });

  it("doesn't count posting a text that is already stored", async () => {
    const { post } = setup();
    await post("a", "same rules");
    await post("a", "same rules");
    await post("a", "same rules");
    expect((await post("a", "other rules")).status).toBe(200);
  });

  it("leaves the reads open", async () => {
    const { post, a } = setup();
    for (const n of [1, 2, 3]) await post("a", `rules ${n}`);
    expect((await a.request(`/api/mandates/${"0".repeat(64)}`)).status).toBe(404);
  });
});
