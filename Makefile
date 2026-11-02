# Red team: every case through the firewall core's judge(), judged with the
# wallet's model, each verdict's signer checked against the wallet's allowlist.
# Writes redteam/results/; publish a run with `pnpm --dir redteam publish-run <file>`.
.PHONY: redteam
redteam:
	pnpm --dir redteam redteam
