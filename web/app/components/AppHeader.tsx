"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { NETWORK, WALLET_ID } from "../lib/near";
import { Skeleton } from "./Skeleton";
import { useNearWallet } from "../lib/useNearWallet";
import "./site-header.css";

// On phones the demo leaves the header; on the smallest, Create does too (My wallets has a Create button).
const LINKS = [
  { href: "/wallets", label: "My wallets", short: "Wallets", hide: "" },
  { href: "/create", label: "Create wallet", short: "Create", hide: "max-[379px]:hidden" },
  // The demo wallet's page inside the app, so the demo opens in the same header and layout as your own wallet. Named for
  // what it opens: the public site's "Live demo" is the feed of payments, /activity.
  { href: `/wallets/${WALLET_ID}`, label: "Demo wallet", short: null, hide: "max-sm:hidden" },
] as const;

/** The app's header: your wallets, and the NEAR account you're signed in with. */
export function AppHeader() {
  const near = useNearWallet();
  const [menu, setMenu] = useState(false);

  return (
    <header className="site-header sticky top-0 z-50">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-[clamp(14px,4.5vw,72px)] py-3.5 max-[479px]:gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-xl font-black max-[379px]:gap-2 max-[379px]:text-lg">
          <span className="site-logo" aria-hidden="true" />
          Intented
        </Link>
        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-mute max-sm:hidden">{NETWORK}</span>
        {/* The current path is only known at request time, so the links render first and mark the current one after. */}
        <Suspense fallback={<NavLinks path={null} />}>
          <CurrentNavLinks />
        </Suspense>
        <div className="relative ml-auto min-w-0">
          {near.account ? (
            <>
              <button
                onClick={() => setMenu((m) => !m)}
                aria-expanded={menu}
                title={near.account}
                className="flex max-w-[220px] items-center gap-2 rounded-full border border-line bg-ink-2 px-3 py-1.5 font-mono text-[12.5px] text-soft hover:border-soft max-[479px]:max-w-[92px]"
              >
                <span className="size-[7px] shrink-0 rounded-full bg-soft" aria-hidden="true" />
                <span className="truncate">{near.account}</span>
              </button>
              {menu && (
                <div className="absolute top-full right-0 mt-2 w-max rounded-[14px] border border-line bg-ink-2 p-1.5 text-sm shadow-lg">
                  <p className="px-3 py-2 font-mono text-xs break-all text-mute">{near.account}</p>
                  <button
                    onClick={() => {
                      setMenu(false);
                      near.disconnect();
                    }}
                    className="w-full rounded-[10px] px-3 py-2 text-left hover:bg-card"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </>
          ) : near.status === "loading" ? (
            // Until the connector loads we don't know whether you're signed in, so hold the place instead of flashing Connect.
            <Skeleton className="h-[34px] w-[min(9rem,28vw)] rounded-full" />
          ) : (
            <button
              onClick={near.connect}
              disabled={near.status !== "ready"}
              className="rounded-full border-[1.5px] border-line bg-ink-2 px-3.5 py-1.5 text-sm font-bold whitespace-nowrap hover:border-soft disabled:opacity-45"
            >
              Connect
            </button>
          )}
        </div>
      </div>
      {(near.connectError || near.status === "failed") && (
        <p className="mx-auto max-w-[1440px] px-[clamp(14px,4.5vw,72px)] pb-2 text-right text-xs text-coral">
          {near.connectError ?? "The wallet list didn't load. Reload to try again."}
        </p>
      )}
    </header>
  );
}

function CurrentNavLinks() {
  return <NavLinks path={usePathname()} />;
}

function NavLinks({ path }: { path: string | null }) {
  return (
    <nav className="flex gap-5 text-[15px] text-mute max-[479px]:gap-3.5 max-[479px]:text-sm">
      {LINKS.map((l) => {
        const onDemo = path === `/wallets/${WALLET_ID}`;
        const active = !!path && (l.href === "/wallets" ? !onDemo && (path === l.href || path.startsWith(`${l.href}/`)) : path === l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`-my-2 py-2 whitespace-nowrap hover:text-text ${active ? "text-text" : ""} ${l.hide}`}
          >
            <span className="max-[479px]:hidden">{l.label}</span>
            {l.short && <span className="hidden max-[479px]:inline">{l.short}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
