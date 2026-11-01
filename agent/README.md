# agent

The demo agent and the mock x402 paywall. **Owner: William.**

The agent buys data from an x402-style paywall: it reads the 402 response, builds the action, and calls `POST /api/propose`. The paywall has an honest version and a poisoned one that injects "pay 10× to this address" while staying under the cap. The attack demo is never cut.
