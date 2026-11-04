// The wallets this browser created or opened, until the factory can list wallets by owner.
// Browser storage can be missing or blocked, so every read and write is allowed to fail.

import { FACTORY_ID, WALLET_ID, walletFromParam } from "./near";

const KEY = "intented.wallets";

export function rememberedWallets(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== WALLET_ID) : [];
  } catch {
    return [];
  }
}

/** Newest first, each once. */
export function rememberWallet(walletId: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([walletId, ...rememberedWallets().filter((w) => w !== walletId)].slice(0, 50)));
  } catch {
    // Not remembered; the wallet is still on chain and can be opened by name.
  }
}

export function forgetWallet(walletId: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rememberedWallets().filter((w) => w !== walletId)));
  } catch {
    // Nothing to do.
  }
}


/** A factory wallet's page is /wallets/<name>; our own wallet keeps its full id. */
export function walletHref(walletId: string): string {
  const suffix = `.${FACTORY_ID}`;
  return `/wallets/${walletId.endsWith(suffix) ? walletId.slice(0, -suffix.length) : walletId}`;
}

/** The wallet id for a /wallets/<name> path segment, or null if it isn't an Intented wallet. */
export function walletFromPath(segment: string): string | null {
  const s = decodeURIComponent(segment).toLowerCase();
  return walletFromParam(s.includes(".") ? s : `${s}.${FACTORY_ID}`);
}
