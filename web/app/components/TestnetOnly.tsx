import Link from "next/link";
import { SITE_URLS, WALLET_ID } from "../lib/near";
import { ArrowUpRight } from "./icons";

/**
 * What the mainnet build shows where the testnet one has Create or My wallets: wallets are made on testnet only.
 * The mainnet site shows one wallet (docs/decisions/2026-11-06-minimal-mainnet-with-a-network-switch.md).
 */
export function TestnetOnly({ title, path }: { title: string; path: "/create" | "/wallets" }) {
  const testnet = SITE_URLS.testnet;
  return (
    <div className="py-[clamp(48px,8vw,112px)]">
      <h1 className="text-[clamp(34px,4vw,56px)] leading-none font-black tracking-[-0.035em]">{title}</h1>
      <p className="mt-4 max-w-[40em] text-mute">
        Wallets are created on NEAR testnet. This site shows Intented on mainnet with one wallet,{" "}
        <span className="font-mono break-all text-text">{WALLET_ID}</span>: its payments, its rules and its limits, with real money.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {testnet && (
          <a href={`${testnet}${path}`} className="inline-flex items-center gap-1.5 rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-lime-ink">
            Open it on testnet <ArrowUpRight className="size-4" />
          </a>
        )}
        <Link href={`/wallets/${WALLET_ID}`} className="rounded-full border border-line px-5 py-2.5 text-sm font-bold hover:bg-ink-2">
          See the mainnet wallet
        </Link>
      </div>
    </div>
  );
}
