import { describe, expect, it } from "vitest";
import { timedFetch, timingSummary } from "../src/timing.js";

// A clock the fake fetch moves forward, so each call takes exactly as long as the test says.
function fake(steps: Record<string, number[]>) {
  let now = 0;
  const left = Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, [...v]]));
  const inner = (async (input: string) => {
    const kind = input.includes("signature") ? "signature" : "chat";
    now += left[kind]!.shift()!;
    return new Response("{}");
  }) as unknown as typeof fetch;
  return { inner, clock: () => now, wait: (ms: number) => (now += ms) };
}

describe("timing a verdict's two NEAR AI calls", () => {
  it("separates the model call from the signature fetch", async () => {
    const f = fake({ chat: [3200], signature: [450] });
    const t = timedFetch(f.inner, f.clock);
    await t.fetch("https://cloud-api.near.ai/v1/chat/completions", { method: "POST" });
    await t.fetch("https://cloud-api.near.ai/v1/signature/chat-1?model=m");
    expect(t.timing()).toEqual({ model_ms: 3200, signature_ms: 450, signature_attempts: 1 });
  });

  it("counts the signature's retries and the waits between them as signature time", async () => {
    const f = fake({ chat: [3000], signature: [200, 200, 300] });
    const t = timedFetch(f.inner, f.clock);
    await t.fetch("https://cloud-api.near.ai/v1/chat/completions");
    await t.fetch("https://cloud-api.near.ai/v1/signature/chat-1");
    f.wait(1000);
    await t.fetch("https://cloud-api.near.ai/v1/signature/chat-1");
    f.wait(1000);
    await t.fetch("https://cloud-api.near.ai/v1/signature/chat-1");
    expect(t.timing()).toEqual({ model_ms: 3000, signature_ms: 2700, signature_attempts: 3 });
  });

  it("reports no signature time when the model call failed before it", async () => {
    const f = fake({ chat: [800], signature: [] });
    const t = timedFetch(f.inner, f.clock);
    await t.fetch("https://cloud-api.near.ai/v1/chat/completions");
    expect(t.timing()).toEqual({ model_ms: 800, signature_ms: 0, signature_attempts: 0 });
  });
});

describe("the run's timing summary", () => {
  it("gives the median of each part and counts the runs that waited on a signature 404", () => {
    const t = (model_ms: number, signature_ms: number, signature_attempts = 1) => ({ model_ms, signature_ms, signature_attempts });
    expect(timingSummary([t(3000, 400), t(3400, 2500, 3), t(3200, 600)])).toEqual({
      median_model_ms: 3200, median_signature_ms: 600, signature_retried_runs: 1, timed_runs: 3,
    });
  });
});
