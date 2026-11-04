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
  /** The wallet the proposal is on. */
  wallet_id: string;
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

export type ProposalPatch = Partial<Omit<ProposalRow, "id" | "wallet_id" | "created_at" | "updated_at" | "mandate_id" | "action" | "args" | "context" | "cross_chain">>;

/** 1Click deposit statuses after which nothing changes. */
export const ONECLICK_FINAL = ["SUCCESS", "REFUNDED", "FAILED"];

const id = (prefix: string) => `${prefix}_${randomBytes(8).toString("hex")}`;

/** `ownWallet`: the API's own wallet, which every proposal from before wallet_id was stored is on. */
export function openStore(path: string, ownWallet = "intented-wallet.testnet") {
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
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY, body_sha256 TEXT NOT NULL, proposal_id TEXT NOT NULL, created_at INTEGER NOT NULL
    );
  `);
  // Added for the cross-chain payment; a database from before it gets the columns empty.
  const columns = (db.prepare("PRAGMA table_info(proposals)").all() as { name: string }[]).map((c) => c.name);
  for (const col of ["cross_chain", "oneclick", "wallet_id"]) if (!columns.includes(col)) db.exec(`ALTER TABLE proposals ADD COLUMN ${col} TEXT`);
  // Added when the API began judging other wallets' proposals: every earlier proposal was on its own wallet.
  db.prepare("UPDATE proposals SET wallet_id = ? WHERE wallet_id IS NULL").run(ownWallet);
  // Not unique: older rows on the API's own wallet repeat ids from before it was redeployed. POST /api/verdict judges each id once in code.
  db.exec("CREATE INDEX IF NOT EXISTS proposals_on_chain ON proposals(wallet_id, chain_proposal_id)");

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

    /** On the API's own wallet unless `wallet_id` says otherwise; `chain_proposal_id` when the agent already proposed it. */
    createProposal(p: {
      mandate_id: string; action: ActionJson; args: string; context: string; cross_chain?: CrossChainField; oneclick?: OneClickState;
      wallet_id?: string; chain_proposal_id?: number;
    }): ProposalRow {
      const now = stamp();
      const pid = id("p");
      const cc = p.cross_chain ? JSON.stringify(p.cross_chain) : null;
      const oc = p.oneclick ? JSON.stringify(p.oneclick) : null;
      db.prepare(
        "INSERT INTO proposals (id, wallet_id, created_at, updated_at, mandate_id, action, args, context, status, step, cross_chain, oneclick, chain_proposal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'judge', ?, ?, ?)",
      ).run(pid, p.wallet_id ?? ownWallet, now, now, p.mandate_id, JSON.stringify(p.action), p.args, p.context, cc, oc, p.chain_proposal_id ?? null);
      return this.getProposal(pid)!;
    },

    /** The stored proposal for a wallet's on-chain proposal id, if one was judged. */
    getProposalOnChain(walletId: string, chainProposalId: number): ProposalRow | undefined {
      const r = db.prepare("SELECT * FROM proposals WHERE wallet_id = ? AND chain_proposal_id = ? ORDER BY created_at DESC LIMIT 1").get(walletId, chainProposalId);
      return r ? toRow(r as Record<string, unknown>) : undefined;
    },

    getIdempotencyKey(key: string): { body_sha256: string; proposal_id: string; created_at: number } | undefined {
      return db.prepare("SELECT body_sha256, proposal_id, created_at FROM idempotency_keys WHERE key = ?").get(key) as
        | { body_sha256: string; proposal_id: string; created_at: number }
        | undefined;
    },

    /** Replaces an expired key's row; the caller checks it has expired. */
    putIdempotencyKey(key: string, body_sha256: string, proposal_id: string, at: number): void {
      db.prepare("INSERT OR REPLACE INTO idempotency_keys (key, body_sha256, proposal_id, created_at) VALUES (?, ?, ?, ?)").run(key, body_sha256, proposal_id, at);
    },

    /** The API's own wallet takes each nonce once, so at most one of its proposals should hold it. Other wallets' nonces are theirs. */
    getProposalByNonce(nonce: string): ProposalRow | undefined {
      const r = db.prepare("SELECT * FROM proposals WHERE wallet_id = ? AND json_extract(action, '$.nonce') = ? ORDER BY created_at LIMIT 1").get(ownWallet, nonce);
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

    /** Proposals created or changed after `since` (ms), oldest change first; only `walletId`'s when given. */
    proposalsSince(since: number, limit = 100, walletId?: string): ProposalRow[] {
      const rows = walletId === undefined
        ? db.prepare("SELECT * FROM proposals WHERE updated_at > ? ORDER BY updated_at ASC LIMIT ?").all(since, limit)
        : db.prepare("SELECT * FROM proposals WHERE updated_at > ? AND wallet_id = ? ORDER BY updated_at ASC LIMIT ?").all(since, walletId, limit);
      return (rows as Record<string, unknown>[]).map(toRow);
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
