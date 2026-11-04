"use client";

import type { NearConnector } from "@hot-labs/near-connect";
import { useEffect, useRef, useState } from "react";
import { NETWORK } from "./near";

/**
 * The visitor's own NEAR wallet, through near-connect. The connector loads only on pages that use this,
 * and restores a previous sign-in. The web app never holds a key: every transaction is signed in the wallet.
 */
export function useNearWallet() {
  const connector = useRef<NearConnector | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  // The connect button is live only once the connector exists, and a failed connect says so instead of doing nothing.
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@hot-labs/near-connect")
      .then(async ({ NearConnector }) => {
        if (cancelled) return;
        const c = new NearConnector({ network: NETWORK });
        connector.current = c;
        c.on("wallet:signIn", (e) => setAccount(e.accounts[0]?.accountId ?? null));
        c.on("wallet:signOut", () => setAccount(null));
        const signedIn = await c.getConnectedWallet().catch(() => null);
        if (cancelled) return;
        setAccount(signedIn?.accounts[0]?.accountId ?? null);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("failed"));
    return () => {
      cancelled = true;
      connector.current?.removeAllListeners();
      connector.current = null;
    };
  }, []);

  async function connect() {
    if (!connector.current) return;
    setConnectError(null);
    try {
      await connector.current.connect();
    } catch (e) {
      // Closing the picker rejects too; only a real failure is worth showing.
      const message = e instanceof Error ? e.message : String(e);
      if (!/reject|cancel|clos/i.test(message)) setConnectError(message || "The wallet didn't connect");
    }
  }

  const disconnect = () => connector.current?.disconnect();

  /** The connected wallet, to sign with; throws if none is connected. */
  async function wallet() {
    if (!connector.current) throw new Error("The wallet connector hasn't loaded");
    return connector.current.wallet();
  }

  return { account, status, connectError, connect, disconnect, wallet };
}
