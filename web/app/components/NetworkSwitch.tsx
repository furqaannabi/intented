"use client";

import { NETWORK, SITE_URLS } from "../lib/near";

const NETWORKS = ["testnet", "mainnet"] as const;
/** Pages both sites have. Anything else (a testnet wallet's page, Create) opens the other site's home. */
const SHARED = new Set(["/", "/activity", "/rules"]);

/**
 * Testnet | Mainnet. Each network is its own build at its own address, so switching opens the other site, on the same
 * page where both have it. A network without an address (NEXT_PUBLIC_TESTNET_URL, NEXT_PUBLIC_MAINNET_URL) shows as text.
 */
export function NetworkSwitch({ className = "" }: { className?: string }) {
  return (
    <div role="group" aria-label="Network" className={`flex shrink-0 rounded-full border border-line p-0.5 font-mono text-[11px] ${className}`}>
      {NETWORKS.map((n) => {
        if (n === NETWORK) {
          return (
            <span key={n} aria-current="true" className="rounded-full bg-card px-2.5 py-1 text-text">
              {n}
            </span>
          );
        }
        const url = SITE_URLS[n];
        if (!url) return null;
        return (
          <a
            key={n}
            href={url}
            // Keep the page the visitor is on when the other site has it too.
            onClick={(e) => {
              if (SHARED.has(location.pathname)) e.currentTarget.href = `${url}${location.pathname === "/" ? "" : location.pathname}`;
            }}
            className="rounded-full px-2.5 py-1 text-mute hover:text-text"
          >
            {n}
          </a>
        );
      })}
    </div>
  );
}
