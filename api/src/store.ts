// SQLite storage for mandates and proposals, the only module that touches the
// database (decisions/2026-11-01-api-hono-and-node-sqlite.md).

import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { CrossChainField, OneClickState } from "./crosschain.js";

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
  /** A payment through 1Click only: the judge request's field, and the deposit's state. */
  cross_chain: CrossChainField | null;
  oneclick: OneClickState | null;
}

export type ProposalPatch = Partial<Omit<ProposalRow, "id" | "created_at" | "updated_at" | "mandate_id" | "action" | "args" | "context" | "cross_chain">>;

/** 1Click deposit statuses after which nothing changes. */
export const ONECLICK_FINAL = ["SUCCESS", "REFUNDED", "FAILED"];

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
    CREATE INDEX IF NOT EXISTS proposals_nonce ON proposals(json_extract(action, '$.nonce'));
  `);
  // Added for the cross-chain payment; a database from before it gets the columns empty.
  const columns = (db.prepare("PRAGMA table_info(proposals)").all() as { name: string }[]).map((c) => c.name);
  for (const col of ["cross_chain", "oneclick"]) if (!columns.includes(col)) db.exec(`ALTER TABLE proposals ADD COLUMN ${col} TEXT`);

  const json = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : null);
  const toRow = (r: Record<string, unknown>): ProposalRow =>
    ({
      ...r, action: JSON.parse(r.action as string), req_bytes: r.req_bytes ?? null, resp_bytes: r.resp_bytes ?? null,
      cross_chain: json(r.cross_chain), oneclick: json(r.oneclick),
    }) as ProposalRow;

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

    /** The newest stored mandate with this hash; the agent posts the same text on every run. */
    getMandateByHash(textHash: string): Mandate | undefined {
      return db.prepare("SELECT * FROM mandates WHERE text_hash = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(textHash) as
        | Mandate
        | undefined;
    },

    createProposal(p: { mandate_id: string; action: ActionJson; args: string; context: string; cross_chain?: CrossChainField; oneclick?: OneClickState }): ProposalRow {
      const now = stamp();
      const pid = id("p");
      const cc = p.cross_chain ? JSON.stringify(p.cross_chain) : null;
      const oc = p.oneclick ? JSON.stringify(p.oneclick) : null;
      db.prepare(
        "INSERT INTO proposals (id, created_at, updated_at, mandate_id, action, args, context, status, step, cross_chain, oneclick) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'judge', ?, ?)",
      ).run(pid, now, now, p.mandate_id, JSON.stringify(p.action), p.args, p.context, cc, oc);
      return this.getProposal(pid)!;
    },

    /** The wallet takes each nonce once, so at most one proposal should hold it. */
    getProposalByNonce(nonce: string): ProposalRow | undefined {
      const r = db.prepare("SELECT * FROM proposals WHERE json_extract(action, '$.nonce') = ? ORDER BY created_at LIMIT 1").get(nonce);
      return r ? toRow(r as Record<string, unknown>) : undefined;
    },

    getProposal(proposalId: string): ProposalRow | undefined {
      const r = db.prepare("SELECT * FROM proposals WHERE id = ?").get(proposalId);
      return r ? toRow(r as Record<string, unknown>) : undefined;
    },

    updateProposal(proposalId: string, patch: ProposalPatch): void {
      const keys = Object.keys(patch) as (keyof ProposalPatch)[];
      const sets = [...keys.map((k) => `${k} = ?`), "updated_at = ?"].join(", ");
      const values = keys.map((k) => (k === "oneclick" ? JSON.stringify(patch[k]) : (patch[k] ?? null)) as string | number | Uint8Array | null);
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

    /** Executed payments through 1Click whose deposit hasn't reached a final status, for the startup check. */
    depositsInFlight(): ProposalRow[] {
      const final = ONECLICK_FINAL.map(() => "?").join(", ");
      const sql = `SELECT * FROM proposals WHERE status = 'executed' AND oneclick IS NOT NULL AND json_extract(oneclick, '$.status') NOT IN (${final})`;
      return (db.prepare(sql).all(...ONECLICK_FINAL) as Record<string, unknown>[]).map(toRow);
    },

    close: () => db.close(),
  };
}

export type Store = ReturnType<typeof openStore>;
