import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openStore } from "../src/store.js";

const app = () =>
  createApp({
    store: openStore(":memory:"),
    network: "testnet",
    model: "Qwen/Qwen3.8-27B",
    agentToken: undefined,
    startPipeline: () => {},
    attestationUrls: {},
    redteam: () => null,
  });

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const post = (a: ReturnType<typeof app>, text: string) =>
  a.request("/api/mandate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }).then((r) => r.json());

describe("GET /api/mandates/:text_hash: a stored mandate's text by its hash", () => {
  it("returns the text exactly as posted, spaces and line breaks included", async () => {
    const a = app();
    const text = "  Buy market data from intented-vendor.testnet only.\nAt most 0.01 wNEAR per call.  ";
    const { mandate_id } = await post(a, text);
    const res = await a.request(`/api/mandates/${sha256(text)}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mandate_id, text, text_hash: sha256(text) });
  });

  it("is a 404 when no stored text has that hash", async () => {
    const res = await app().request(`/api/mandates/${sha256("never posted")}`);
    expect(res.status).toBe(404);
  });

  it("is a 400 unless the hash is 64 lowercase hex characters", async () => {
    const a = app();
    const hash = sha256("x");
    for (const bad of [hash.toUpperCase(), hash.slice(1), `${hash}0`, "not-a-hash"]) {
      expect((await a.request(`/api/mandates/${bad}`)).status).toBe(400);
    }
  });

  it("returns the newest when the same text was posted more than once", async () => {
    const a = app();
    await post(a, "same rules");
    const { mandate_id: newest } = await post(a, "same rules");
    expect((await (await a.request(`/api/mandates/${sha256("same rules")}`)).json()).mandate_id).toBe(newest);
  });
});

describe("POST /api/mandate: posting the same text again", () => {
  it("returns the mandate already stored instead of storing a second", async () => {
    const a = app();
    const first = await post(a, "same rules");
    expect(await post(a, "same rules")).toEqual(first);
  });

  it("still stores a text that differs by one character", async () => {
    const a = app();
    const first = await post(a, "same rules");
    expect((await post(a, "same rules.")).mandate_id).not.toBe(first.mandate_id);
  });
});
