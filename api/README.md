# api

The HTTP API the web app and the demo agent use, proposal storage, and the 1Click module. **Owner: William.**

- **API:** the endpoints in [`docs/interface-spec.md`](../docs/interface-spec.md). Stores proposals, verdicts and the raw request and response bytes in SQLite, calls the firewall core (a stub until 6 November), and handles retries and logging.
- **1Click module:** quote → deposit address → submit → status polling → refund, for NEAR USDC → Base USDC, with the status written back into each proposal.

Framework (Hono or Express) and host (Railway or Render) are William's call; record the choice in [`docs/decisions/`](../docs/decisions/README.md).

**Day 1:** KT4, a real 1Click payment that arrives at the Base address. Scaffold the API.
