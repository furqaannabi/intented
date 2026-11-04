import { createHash } from "node:crypto";
import { canonicalBytes } from "@intented/firewall-core";
import { describe, expect, it } from "vitest";
import { paymentAction } from "../src/wallet.js";

const now = 1_762_000_000_000;
const payment = { token: "wrap.testnet", to: "intented-vendor.testnet", amount: "1000000000000000000000", memo: "market data" };

describe("paymentAction", () => {
  it("builds an ft_transfer the contract can encode, hashed over the exact args it sends", () => {
    const { action, argsJson } = paymentAction(payment, now);

    expect(JSON.parse(argsJson)).toEqual({ receiver_id: payment.to, amount: payment.amount, memo: "market data" });
    expect(action).toEqual({
      receiver_id: "wrap.testnet",
      method: "ft_transfer",
      args_sha256: createHash("sha256").update(argsJson, "utf8").digest("hex"),
      deposit: "1",
      nonce: BigInt(now),
      expiry_ms: BigInt(now + 15 * 60_000),
    });
    expect(() => canonicalBytes(action)).not.toThrow();
  });
});
