// An owner's wallets come from the factory on chain (get_wallets). Wallets opened by name are
// remembered on this browser too, so someone else's wallet can be found again.
// Browser storage can be missing or blocked, so every read and write is allowed to fail.

import { FACTORY_ID, viewOn, WALLET_ID, walletFromParam } from "./near";

const PAGE = 100; // the factory's most per call

/** Every wallet the factory created for this owner, oldest first. */
export async function ownedWallets(ownerId: string): Promise<string[]> {
  if (!FACTORY_ID) return [];
  const all: string[] = [];
  for (;;) {
    const page = await viewOn<string[]>(FACTORY_ID, "get_wallets", { owner_id: ownerId, from_index: all.length, limit: PAGE });
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

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
