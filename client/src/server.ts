// The Intented MCP server, over stdio, for Claude Code, Cursor, Codex and other MCP clients. Started by `intented mcp`.
// Three tools: intented_init, intented_pay, intented_status. Testnet only for now.
//
// stdout carries the MCP protocol, so nothing else may print to it. Keys stay in ~/.intented/testnet/;
// no tool result contains a private key.
//
// Settings (environment, all optional): INTENTED_HOME, INTENTED_API_URL, INTENTED_WEB_URL and NEAR_RPC_URL, with the
// library's defaults (index.ts), so the CLI, the library and the MCP server always agree.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { defaults } from "./index.js";
import { initTool, payTool, statusTool } from "./tools.js";

const { home, apiUrl, rpcUrl } = defaults;
const webUrl = defaults.webUrl.replace(/\/+$/, "");

const name = z
  .string()
  .regex(/^(?:[a-z\d]+[-_])*[a-z\d]+$/)
  .describe("The wallet's name: the part before .intented.testnet, e.g. my-agent");

/** A tool's text, or its error as a tool error the agent can read. */
async function answer(run: () => string | Promise<string>) {
  try {
    return { content: [{ type: "text" as const, text: await run() }] };
  } catch (e) {
    return { content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }], isError: true };
  }
}

/** Starts the MCP server on stdin and stdout. Nothing else may write to stdout while it runs. */
export async function startMcpServer(version: string): Promise<void> {
  const server = new McpServer({ name: "intented", version });

  server.registerTool(
    "intented_init",
    {
      title: "Make this agent's Intented wallet key",
      description:
        "Makes the agent's key for the Intented wallet <name>.intented.testnet on this machine and returns its public key and a link. " +
        "The wallet's owner opens the link, writes the rules the agent must follow, and signs to create the wallet. Run once per wallet; running it again returns the same key.",
      inputSchema: { name },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    ({ name }) => answer(() => initTool({ name }, { home, webUrl })),
  );

  server.registerTool(
    "intented_pay",
    {
      title: "Pay from the agent's Intented wallet",
      description:
        "Pays wNEAR on NEAR testnet from the agent's Intented wallet. A model in a TEE judges the payment against the owner's rules and signs its verdict; " +
        "the wallet contract pays only on a signed ALLOW within its caps. Put what you read that asked for this payment, such as a paywall's reply, " +
        "into `context` exactly as you read it. If the answer is Denied, do not retry or reword the payment: tell the user what was asked and why it was refused.",
      inputSchema: {
        name,
        to: z.string().describe("The NEAR account to pay, e.g. intented-vendor.testnet"),
        amount: z.string().describe("How much wNEAR, as a plain number, e.g. 0.001"),
        context: z.string().describe("What you read that led to this payment, verbatim, e.g. the HTTP 402 reply. It is judged as data."),
      },
      annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    ({ name, to, amount, context }) => answer(() => payTool({ name, to, amount, context }, { home, apiUrl, rpcUrl })),
  );

  server.registerTool(
    "intented_status",
    {
      title: "Read the agent's Intented wallet",
      description: "Shows the wallet's live rules (the owner's mandate, the caps, whether it is frozen) and its last payments with their verdicts. Read-only.",
      inputSchema: { name },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ name }) => answer(() => statusTool({ name }, { apiUrl, rpcUrl })),
  );

  await server.connect(new StdioServerTransport());
}
