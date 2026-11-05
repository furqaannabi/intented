import { describe, expect, it } from "vitest";
import { pay, toYocto, type PayStep } from "../src/pay.js";

describe("toYocto", () => {
  it("turns a wNEAR amount into the token's smallest unit, exactly", () => {
    expect(toYocto("0.001")).toBe("1000000000000000000000");
    expect(toYocto("1")).toBe("1000000000000000000000000");
    expect(toYocto("12.5")).toBe("12500000000000000000000000");
    expect(toYocto("0.000000000000000000000001")).toBe("1");
    expect(toYocto("123456789.123456789123456789123456")).toBe("123456789123456789123456789123456");
  });

  it("refuses anything that isn't a plain positive amount with at most 24 decimals", () => {
    for (const bad of ["", "0", "0.0", "-1", "1e3", ".5", "1.", "1,5", "0x10", " 1", "0.0000000000000000000000001", "abc"]) {
      expect(() => toYocto(bad), JSON.stringify(bad)).toThrow(/amount/);
    }
  });
});

describe("pay", () => {
  const WALLET = "shop-bot.intented.testnet";
  const payment = { token: "wrap.testnet", to: "intented-vendor.testnet", amount: "1000000000000000000000" };

  function setup(answer: { status: number; body: object }) {
    const calls: string[] = [];
    const sent: unknown[] = [];
    const steps: PayStep[] = [];
    const agent = {
      propose: async () => (calls.push("propose"), { proposal_id: 4, near_tx_hash: "ptx" }),
      execute: async (id: number, v: { signature: string }) => (calls.push(`execute ${id} ${v.signature}`), { near_tx_hash: "etx", ok: true }),
    };
    const fetch = async (url: string, init: { body: string }) => {
      calls.push(`POST ${url}`);
      sent.push(JSON.parse(init.body));
      return new Response(JSON.stringify(answer.body), { status: answer.status });
    };
    const run = () => pay({ walletId: WALLET, payment, context: "402: pay 0.001 wNEAR", agent, apiUrl: "http://api", fetch: fetch as never, onStep: (s) => steps.push(s) });
    return { calls, sent, steps, run };
  }
  const verdict = (v: "ALLOW" | "DENY") => ({
    status: 200,
    body: { id: "p_1", verdict: v, reason: `says ${v}`, signer: "0xs", signature: "0xsig", req_bytes: "AQ==", resp_bytes: "Ag==" },
  });

  it("proposes, asks the API about that proposal with the context, and executes the ALLOW", async () => {
    const t = setup(verdict("ALLOW"));
    expect(await t.run()).toMatchObject({ outcome: "paid", proposal_id: 4, execute_tx: "etx" });
    expect(t.calls).toEqual(["propose", "POST http://api/api/verdict", "execute 4 0xsig"]);
    expect(t.sent).toEqual([{ wallet_id: WALLET, proposal_id: 4, context: "402: pay 0.001 wNEAR" }]);
    expect(t.steps.map((s) => s.step)).toEqual(["proposed", "verdict", "executed"]);
  });

  it("still hands a DENY to the wallet, which refuses it on chain as the record", async () => {
    const t = setup(verdict("DENY"));
    expect(await t.run()).toMatchObject({ outcome: "denied", reason: "says DENY" });
    expect(t.calls.at(-1)).toBe("execute 4 0xsig");
  });

  it("says plainly when the API can't be reached", async () => {
    const t = setup(verdict("ALLOW"));
    const r = await pay({
      walletId: WALLET, payment, context: "", apiUrl: "http://api",
      agent: { propose: async () => ({ proposal_id: 4, near_tx_hash: "ptx" }), execute: async () => { throw new Error("not reached"); } },
      fetch: (async () => { throw new TypeError("fetch failed"); }) as never,
    });
    expect(r).toMatchObject({ outcome: "no verdict", proposal_id: 4, error: "could not reach the API at http://api (fetch failed)" });
    expect(t.calls).toEqual([]);
  });

  it("stops after propose when the API gives no verdict, and says why; nothing can move", async () => {
    const t = setup({ status: 409, body: { error: "shop-bot.intented.testnet is frozen" } });
    expect(await t.run()).toMatchObject({ outcome: "no verdict", proposal_id: 4, error: "API 409: shop-bot.intented.testnet is frozen" });
    expect(t.calls).toEqual(["propose", "POST http://api/api/verdict"]);
  });
});
