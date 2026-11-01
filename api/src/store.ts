// SQLite storage for mandates and proposals, the only module that touches the
// database (decisions/2026-11-01-api-hono-and-node-sqlite.md).

import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export type Status = "pending" | "allowed" | "denied" | "executed" | "failed";
/** The pipeline step a proposal last reached; "done" once settled. */
export type Step = "judge" | "propose" | "execute" | "done";

export interface Mandate {
  id: string;
  text: string;
  text_hash: string;
  created_at: number;
}

/** The action as the API received it: every number a decimal string. */
export interface ActionJson {
  receiver_id: string;
  method: string;
  args_sha256: string;
  deposit: string;
  nonce: string;
  expiry_ms: string;
}

export interface ProposalRow {
  id: string;
  created_at: number;
  updated_at: number;
  mandate_id: string;
  action: ActionJson;
  args: string;
  context: string;
  status: Status;
  step: Step;
  verdict: "ALLOW" | "DENY" | null;
  reason: string | null;
  model: string | null;
  chat_id: string | null;
  signature: string | null;
  signer: string | null;
  req_bytes: Uint8Array | null;
  resp_bytes: Uint8Array | null;
  chain_proposal_id: number | null;
  propose_tx_hash: string | null;
  near_tx_hash: string | null;
}

export type ProposalPatch = Partial<Omit<ProposalRow, "id" | "created_at" | "updated_at" | "mandate_id" | "action" | "args" | "context">>;

const id = (prefix: string) => `${prefix}_${randomBytes(8).toString("hex")}`;

export function openStore(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS mandates (
      id TEXT PRIMARY KEY, text TEXT NOT NULL, text_hash TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      mandate_id TEXT NOT NULL REFERENCES mandates(id),
      action TEXT NOT NULL, args TEXT NOT NULL, context TEXT NOT NULL,
      status TEXT NOT NULL, step TEXT NOT NULL,
      verdict TEXT, reason TEXT, model TEXT, chat_id TEXT, signature TEXT, signer TEXT,
      req_bytes BLOB, resp_bytes BLOB,
      chain_proposal_id INTEGER, propose_tx_hash TEXT, near_tx_hash TEXT
    );
    CREATE INDEX IF NOT EXISTS proposals_updated_at ON proposals(updated_at);
  `);

  const toRow = (r: Record<string, unknown>): ProposalRow =>
    ({ ...r, action: JSON.parse(r.action as string), req_bytes: r.req_bytes ?? null, resp_bytes: r.resp_bytes ?? null }) as ProposalRow;

  // updated_at strictly increases, so polling with since=<last updated_at> never misses a change made in the same millisecond.
  let lastStamp = 0;
  const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));

  return {
    createMandate(text: string, text_hash: string): Mandate {
      const m = { id: id("m"), text, text_hash, created_at: Date.now() };
      db.prepare("INSERT INTO mandates (id, text, text_hash, created_at) VALUES (?, ?, ?, ?)").run(m.id, m.text, m.text_hash, m.created_at);
      return m;
    },

    getMandate(mandateId: string): Mandate | undefined {
      return db.prepare("SELECT * FROM mandates WHERE id = ?").get(mandateId) as Mandate | undefined;
    },

    createProposal(p: { mandate_id: string; action: ActionJson; args: string; context: string }): ProposalRow {
      const now = stamp();
      const pid = id("p");
      db.prepare(
        "INSERT INTO proposals (id, created_at, updated_at, mandate_id, action, args, context, status, step) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'judge')",
      ).run(pid, now, now, p.mandate_id, JSON.stringify(p.action), p.args, p.context);
      return this.getProposal(pid)!;
    },

    getProposal(proposalId: string): ProposalRow | undefined {
      const r = db.prepare("SELECT * FROM proposals WHERE id = ?").get(proposalId);
      return r ? toRow(r as Record<string, unknown>) : undefined;
    },

    updateProposal(proposalId: string, patch: ProposalPatch): void {
      const keys = Object.keys(patch) as (keyof ProposalPatch)[];
      const sets = [...keys.map((k) => `${k} = ?`), "updated_at = ?"].join(", ");
      const values = keys.map((k) => (patch[k] ?? null) as string | number | Uint8Array | null);
      db.prepare(`UPDATE proposals SET ${sets} WHERE id = ?`).run(...values, stamp(), proposalId);
    },

    /** Proposals created or changed after `since` (ms), oldest change first. */
    proposalsSince(since: number, limit = 100): ProposalRow[] {
      return (db.prepare("SELECT * FROM proposals WHERE updated_at > ? ORDER BY updated_at ASC LIMIT ?").all(since, limit) as Record<string, unknown>[]).map(toRow);
    },

    /** Proposals the pipeline has not settled, for the startup check. */
    unsettled(): ProposalRow[] {
      return (db.prepare("SELECT * FROM proposals WHERE step != 'done'").all() as Record<string, unknown>[]).map(toRow);
    },

    close: () => db.close(),
  };
}

export type Store = ReturnType<typeof openStore>;
