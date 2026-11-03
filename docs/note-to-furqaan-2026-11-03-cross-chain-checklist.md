# Note to Furqaan: your cross-chain work, as a checklist

From William, 3 November. The design is accepted ([record](./decisions/2026-11-03-cross-chain-through-1click.md)) and in the [interface spec](./interface-spec.md) (the judge request, `execute` check 6, the owner methods, `judge()`). This is the same work, in build order, each item with what "done" means.

The API side is being built now against a fake judge. Until your `judge()` takes `cross_chain`, the live API refuses a cross-chain propose with a 501, so nothing pays 1Click without the judge seeing the Base recipient.

## firewall-core

1. **`judge()` takes `cross_chain` as an optional fifth argument** and puts it in the request exactly as the spec's `cross_chain` object. It is never read from the agent.
   - Done when: a request built with it carries the six fields; a request built without it is byte for byte what it is today.
2. **`buildJudgeRequest` checks the field before any NEAR AI call:**
   - the method is `ft_transfer`;
   - `deposit_address` equals `args.receiver_id`;
   - `recipient` is lowercase `0x` plus 40 hex characters;
   - `deadline_ms` is a u64 decimal string and `expiry_ms` is earlier.

   Done when: each failure throws, with a test for each.
3. **The prompt.** When `cross_chain` is present, the payee is `cross_chain.recipient` on `cross_chain.dest_chain`, and what the recipient receives is `amount_out`. Like `amount`, the field is trusted firewall data, not context.
   - Done when: the new prompt hash is published, and an honest Base payment and the poisoned one (4 USDC to `0xbad0…0bad`) get the right verdicts in a quick run.

## contract

4. **`execute` check 6 for a request with `cross_chain`**, all five conditions in the spec: the method and deposit address, the recipient's form, the expiry before the deadline, the switch, and the recipient list.
   - Done when: there's a failing test for each condition, plus one success. These are on the list of tests that can't be skipped.
5. **The owner's switch:** `set_cross_chain(enabled)`, off by default. While it's off, `execute` refuses any request with the field.
6. **The recipient list:** `allow_cross_chain_recipient(address)` and `disallow_cross_chain_recipient(address)`. While the list is empty, the switch alone decides; once it isn't, any other recipient is refused, even on an `ALLOW`. If time is short, this is the first thing to cut.
7. **`get_config` shows the switch and the list.**

## testnet wallet

8. **Deploy, then on `intented-wallet.testnet`:**
   - `set_prompt_hash` with the new prompt's hash;
   - `set_cross_chain(true)`.

   The caps need no change. At the stand-in's rate (500 USDC per wNEAR, plus 1%), the honest 0.40 USDC costs about 0.0008 wNEAR and the poisoned 4 USDC about 0.008, both under the 0.01 per-transaction cap. So the attack still has to be caught by meaning, not by the cap. The receiver stays `wrap.testnet`, which is already allowlisted.

## Tell William when

- **Item 1 lands:** the API's 501 comes off, and the red-team cross-chain cases can run.
- **Item 8 is done:** the first end-to-end cross-chain payment on testnet, through the stand-in.

## Not yours

The quote, the action and the field are built by the API. The deposit tracking, the stand-in, the paywall's Base check, the agent's cross-chain path, the web app's "simulated" label and the red-team cases are William's. The real mainnet payment still needs a yes from both of you.
