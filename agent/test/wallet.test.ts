import { createHash } from "node:crypto";
import { canonicalBytes } from "@intented/firewall-core";
import { describe, expect, it } from "vitest";
import { outOfGas, paymentAction } from "../src/wallet.js";

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

  it("expires when told, so a payment through 1Click ends before its quote does", () => {
    const deadline = now + 30 * 60_000;
    expect(paymentAction({ ...payment, expiresAt: deadline - 5 * 60_000 }, now).action.expiry_ms).toBe(BigInt(deadline - 5 * 60_000));
  });
});

describe("outOfGas", () => {
  const wallet = "shop-bot.intented.testnet";
  const named = (name: string, message = "") => Object.assign(new Error(message), { name });

  it("says the wallet is out of NEAR, in words the agent's user can act on", () => {
    for (const e of [named("NotEnoughBalanceError"), named("LackBalanceForStateActionError"), new Error('propose failed: {"ActionError":{"kind":{"LackBalanceForState":{}}}}')]) {
      expect(outOfGas(e, wallet)).toBe(`${wallet} has no NEAR left for gas. Ask its owner to send NEAR to ${wallet}.`);
    }
  });

  it("says the key's gas limit is used up", () => {
    expect(outOfGas(named("AccessKeyNotEnoughAllowanceActionError"), wallet)).toBe(
      `This agent's key has used up its gas limit on ${wallet}. Ask its owner to add the key again with a new limit.`,
    );
  });

  it("says the key isn't on the wallet", () => {
    expect(outOfGas(named("AccessKeyDoesNotExistError"), wallet)).toBe(
      `This agent's key isn't on ${wallet}. Ask its owner to add it, or run pnpm intented init for a new one.`,
    );
  });

  it("leaves any other error alone", () => {
    expect(outOfGas(new Error("Smart contract panicked: nonce already used"), wallet)).toBeNull();
    expect(outOfGas("not an error", wallet)).toBeNull();
  });
});
