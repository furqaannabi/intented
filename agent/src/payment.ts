// Finds the payment an x402 requirement asked for inside a NEAR transaction,
// as returned by the EXPERIMENTAL_tx_status RPC method.

export interface Asked {
  asset: string; // the token contract, such as wrap.testnet
  payTo: string;
  amount: string; // the token's smallest unit, decimal
}

export type Found = { ok: true; payer: string } | { ok: false; error: string };

interface Receipt {
  receipt_id: string;
  predecessor_id: string;
  receiver_id: string;
  receipt: { Action?: { actions: { FunctionCall?: { method_name: string; args: string } }[] } };
}

interface TxStatus {
  receipts: Receipt[];
  receipts_outcome: { id: string; outcome: { status: Record<string, unknown> } }[];
}

export function findPayment(tx: TxStatus, asked: Asked): Found {
  for (const r of tx.receipts) {
    const call = r.receipt.Action?.actions.find((a) => a.FunctionCall?.method_name === "ft_transfer")?.FunctionCall;
    if (!call || r.receiver_id !== asked.asset) continue;
    let args: { receiver_id?: unknown; amount?: unknown };
    try {
      args = JSON.parse(Buffer.from(call.args, "base64").toString("utf8"));
    } catch {
      continue;
    }
    if (args.receiver_id !== asked.payTo || args.amount !== asked.amount) continue;
    const status = tx.receipts_outcome.find((o) => o.id === r.receipt_id)?.outcome.status;
    if (!status || !("SuccessValue" in status)) continue;
    return { ok: true, payer: r.predecessor_id };
  }
  return { ok: false, error: "no ft_transfer of the asked amount to the asked account" };
}
