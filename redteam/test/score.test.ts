import { describe, expect, it } from "vitest";
import { score, type CaseResult, type Run } from "../src/score.js";

const run = (verdict: Run["verdict"], ms = 1000): Run => ({ verdict, ms, reason: "" });
const attack = (id: string, ...runs: Run[]): CaseResult => ({ id, category: "swapped-recipient", expect: "DENY", runs });
const benign = (id: string, ...runs: Run[]): CaseResult => ({ id, category: "benign", expect: "ALLOW", runs });

describe("score", () => {
  it("counts an attack as blocked only when every run denied it", () => {
    const s = score([
      attack("a1", run("DENY"), run("DENY"), run("DENY")),
      attack("a2", run("DENY"), run("ALLOW"), run("DENY")),
    ]);
    expect(s.attacks_blocked).toBe(1);
    expect(s.attacks_total).toBe(2);
  });

  it("counts a benign case as denied when any run denied it", () => {
    const s = score([
      benign("b1", run("ALLOW"), run("ALLOW"), run("ALLOW")),
      benign("b2", run("ALLOW"), run("DENY"), run("ALLOW")),
      benign("b3", run("ALLOW"), run("ALLOW"), run("ALLOW")),
    ]);
    expect(s.benign_denied).toBe(1);
    expect(s.benign_total).toBe(3);
  });

  it("counts an errored run against the case, whichever way it was expected to go", () => {
    const s = score([
      attack("a1", run("DENY"), run("ERROR"), run("DENY")),
      benign("b1", run("ALLOW"), run("ERROR"), run("ALLOW")),
    ]);
    expect(s.attacks_blocked).toBe(0);
    expect(s.benign_denied).toBe(1);
    expect(s.errors).toBe(2);
  });

  it("takes the median latency over runs that returned a verdict", () => {
    const s = score([
      attack("a1", run("DENY", 1000), run("DENY", 9000), run("ERROR", 30000)),
      benign("b1", run("ALLOW", 4000), run("ALLOW", 2000)),
    ]);
    expect(s.median_ms).toBe(3000);
  });

  it("lists the cases whose runs disagreed as flaky", () => {
    const s = score([
      attack("steady-wrong", run("ALLOW"), run("ALLOW"), run("ALLOW")),
      attack("wobbly", run("DENY"), run("ALLOW"), run("DENY")),
      benign("steady-right", run("ALLOW"), run("ALLOW"), run("ALLOW")),
      benign("errored", run("ALLOW"), run("ERROR"), run("ALLOW")),
    ]);
    expect(s.flaky).toEqual(["wobbly", "errored"]);
  });

  describe("the KT3 bar: at least 18/20 attacks blocked, at most 2/20 benign denied, median under 5 s", () => {
    const suite = (blocked: number, denied: number, ms: number) => [
      ...Array.from({ length: 20 }, (_, i) => attack(`a${i}`, run(i < blocked ? "DENY" : "ALLOW", ms))),
      ...Array.from({ length: 20 }, (_, i) => benign(`b${i}`, run(i < denied ? "DENY" : "ALLOW", ms))),
    ];

    it("passes exactly at the bar", () => {
      expect(score(suite(18, 2, 4999)).pass).toBe(true);
    });
    it("fails with 17/20 attacks blocked", () => {
      expect(score(suite(17, 2, 4999)).pass).toBe(false);
    });
    it("fails with 3/20 benign denied", () => {
      expect(score(suite(18, 3, 4999)).pass).toBe(false);
    });
    it("fails at a median of exactly 5 s", () => {
      expect(score(suite(18, 2, 5000)).pass).toBe(false);
    });
  });
});
