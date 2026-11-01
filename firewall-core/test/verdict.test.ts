import { describe, expect, it } from "vitest";
import { parseVerdict } from "../src/verdict.js";

const action = `INTENTED_V1|vendor.testnet|ft_transfer|${"a".repeat(64)}|1|7|1762041600000`;
const json = (o: unknown) => JSON.stringify(o);

describe("parseVerdict", () => {
  it("passes a well-formed ALLOW or DENY for this action through", () => {
    expect(parseVerdict(json({ verdict: "ALLOW", reason: "fits", action }), action)).toEqual({ verdict: "ALLOW", reason: "fits" });
    expect(parseVerdict(json({ verdict: "DENY", reason: "no", action }), action)).toEqual({ verdict: "DENY", reason: "no" });
  });

  const ok = { verdict: "ALLOW", reason: "fits", action };

  it("allows a reason of exactly 280 characters", () => {
    expect(parseVerdict(json({ ...ok, reason: "r".repeat(280) }), action).verdict).toBe("ALLOW");
  });

  it.each([
    ["empty", ""],
    ["prose", "ALLOW"],
    ["a JSON string", json("ALLOW")],
    ["null", "null"],
    ["an array", json([ok])],
    ["a markdown fence", "```json\n" + json(ok) + "\n```"],
    ["lowercase allow", json({ ...ok, verdict: "allow" })],
    ["a padded verdict", json({ ...ok, verdict: "ALLOW " })],
    ["a boolean verdict", json({ ...ok, verdict: true })],
    ["no verdict", json({ reason: "fits", action })],
    ["no reason", json({ verdict: "ALLOW", action })],
    ["a non-string reason", json({ ...ok, reason: 1 })],
    ["a 281-char reason", json({ ...ok, reason: "r".repeat(281) })],
    ["no action", json({ verdict: "ALLOW", reason: "fits" })],
    ["a different action", json({ ...ok, action: action.replace("|7|", "|8|") })],
    ["an action with trailing space", json({ ...ok, action: action + " " })],
    ["an extra key", json({ ...ok, override: true })],
    ["a duplicate verdict key", `{"verdict":"DENY","verdict":"ALLOW","reason":"fits","action":${json(action)}}`],
    ["an escaped duplicate verdict key", `{"verdict":"DENY","\\u0076erdict":"ALLOW","reason":"fits","action":${json(action)}}`],
    ["a duplicate action key", `{"verdict":"ALLOW","reason":"fits","action":"x","action":${json(action)}}`],
  ])("denies %s", (_, content) => {
    expect(parseVerdict(content, action).verdict).toBe("DENY");
  });
});
