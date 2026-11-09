#!/usr/bin/env bash
# Deploys and configures one Intented wallet, the way intented-wallet.testnet was set up.
#
# Steps: build the contract; deploy it to WALLET_ID with new(owner, agent, model); as the
# owner, set the prompt hash, the token and its caps, the receiver allowlist, the NEAR caps
# and (optionally) the mandate; verify the model's TEE attestation off-chain and register its
# signer (firewall-core's `pnpm attest --register`); print the agent key command and the config.
#
# Needs: near-cli-rs with WALLET_ID's and OWNER_ID's keys in the keychain (WALLET_ID must
# already exist and be empty), cargo-near, pnpm, and NEAR_AI_API_KEY in the repo's .env.
#
# Usage (names only; values are yours):
#   WALLET_ID=my-wallet.testnet OWNER_ID=me.testnet AGENT_ID=my-agent.testnet \
#   MODEL=Qwen/Qwen3.8-27B NETWORK=testnet \
#   TOKEN_ID=wrap.testnet TOKEN_PER_TX=10000000000000000000000 TOKEN_DAILY=50000000000000000000000 \
#   MANDATE_TEXT="Buy market data from vendor.testnet only. Pay in wNEAR, at most 0.01 wNEAR per call." \
#   contract/wallet/scripts/deploy-wallet.sh
#
# Mainnet moves real money: it also needs CONFIRM_MAINNET=yes, and in this project a yes
# from both owners before anyone runs it.

set -euo pipefail

: "${WALLET_ID:?}" "${OWNER_ID:?}" "${AGENT_ID:?}" "${MODEL:?}" "${NETWORK:?}"
: "${TOKEN_ID:?}" "${TOKEN_PER_TX:?}" "${TOKEN_DAILY:?}"
NEAR_PER_TX="${NEAR_PER_TX:-1}"   # yoctoNEAR: the 1 yocto security deposit of ft_transfer
NEAR_DAILY="${NEAR_DAILY:-100}"

case "$NETWORK" in
  testnet) ;;
  mainnet) [ "${CONFIRM_MAINNET:-}" = "yes" ] || { echo "mainnet needs CONFIRM_MAINNET=yes (and both owners' yes)" >&2; exit 1; } ;;
  *) echo "NETWORK must be testnet or mainnet" >&2; exit 1 ;;
esac

here="$(cd "$(dirname "$0")" && pwd)"
wallet_dir="$here/.."
core_dir="$here/../../../firewall-core"

# The token's symbol and decimals must be the firewall core's, or the wallet refuses every
# transfer of it (the shown amount would never match). Read them from its table.
read -r TOKEN_SYMBOL TOKEN_DECIMALS PROMPT_HASH < <(
  cd "$core_dir" && NETWORK="$NETWORK" TOKEN_ID="$TOKEN_ID" pnpm -s exec tsx -e '
    import { createHash } from "node:crypto";
    import { KNOWN_TOKENS, systemPrompt } from "./src/index.ts";
    const net = process.env.NETWORK as "testnet" | "mainnet";
    const t = KNOWN_TOKENS[net].find((k) => k.contract === process.env.TOKEN_ID);
    if (!t) { console.error(`${process.env.TOKEN_ID} is not in the firewall core'"'"'s ${net} token table`); process.exit(1); }
    console.log(t.symbol, t.decimals, createHash("sha256").update(systemPrompt(net), "utf8").digest("hex"));'
)

owner_call() {
  echo "  $1"
  near contract call-function as-transaction "$WALLET_ID" "$1" json-args "$2" \
    prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as "$OWNER_ID" network-config "$NETWORK" sign-with-keychain send >/dev/null
}

echo "1. build"
# Reproducible: the pinned image in Cargo.toml, so anyone can rebuild this wasm and match its hash.
# It refuses to run on an uncommitted tree.
(cd "$wallet_dir" && cargo near build reproducible-wasm >/dev/null)

echo "2. deploy $WALLET_ID with new(owner=$OWNER_ID, agent=$AGENT_ID, model=$MODEL)"
near contract deploy "$WALLET_ID" use-file "$wallet_dir/target/near/intented_wallet.wasm" \
  with-init-call new json-args "$(printf '{"owner_id":"%s","agent_id":"%s","model_id":"%s"}' "$OWNER_ID" "$AGENT_ID" "$MODEL")" \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config "$NETWORK" sign-with-keychain send >/dev/null

echo "3. owner settings"
owner_call set_prompt_hash "{\"text_hash\":\"$PROMPT_HASH\"}"
owner_call allow_receiver "{\"receiver_id\":\"$TOKEN_ID\"}"
owner_call set_token "{\"token_id\":\"$TOKEN_ID\",\"token\":{\"symbol\":\"$TOKEN_SYMBOL\",\"decimals\":$TOKEN_DECIMALS,\"caps\":{\"per_tx\":\"$TOKEN_PER_TX\",\"daily\":\"$TOKEN_DAILY\"}}}"
owner_call set_near_caps "{\"caps\":{\"per_tx\":\"$NEAR_PER_TX\",\"daily\":\"$NEAR_DAILY\"}}"
if [ -n "${MANDATE_TEXT:-}" ]; then
  mandate_hash="$(printf '%s' "$MANDATE_TEXT" | shasum -a 256 | cut -d' ' -f1)"
  owner_call set_mandate "{\"text_hash\":\"$mandate_hash\"}"
fi

echo "4. verify the model's attestation off-chain and register its signer"
(cd "$core_dir" && CONTRACT_ACCOUNT_ID="$WALLET_ID" OWNER_ACCOUNT_ID="$OWNER_ID" NEAR_AI_MODEL="$MODEL" NEAR_NETWORK="$NETWORK" pnpm -s attest --register)

cat <<EOF
5. the agent's key: whoever controls $AGENT_ID generates a key pair on their own machine and adds it
   with this command. The private half never leaves that machine.

   near account add-key $AGENT_ID grant-function-call-access --allowance '1 NEAR' \\
     --contract-account-id $WALLET_ID --function-names 'propose, execute' \\
     use-manually-provided-public-key 'ed25519:<AGENT_PUBLIC_KEY>' network-config $NETWORK sign-with-keychain send

Not done here: funding the wallet with $TOKEN_SYMBOL, and the receiver's and payees' storage on $TOKEN_ID.
$WALLET_ID's own full-access key can still redeploy the contract; on mainnet, decide who keeps it.

EOF
near contract call-function as-read-only "$WALLET_ID" get_config json-args '{}' network-config "$NETWORK" now 2>&1 | sed -n '/^{/,/^}/p'
