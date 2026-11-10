import Link from "next/link";
import { IS_MAINNET, WALLET_ID } from "../lib/near";
import { ArrowUpRight } from "./icons";
import { NetworkSwitch } from "./NetworkSwitch";
import "./site-header.css";

export const REPO = "https://github.com/furqaannabi/intented";

/** The public site's header: what Intented is, the live demo, and one way into the app. The app has its own, AppHeader. */
export function SiteHeader({ current }: { current?: "home" | "demo" }) {
  const link = "-my-2 py-2 whitespace-nowrap hover:text-text";
  return (
    <header className="site-header sticky top-0 z-50">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-[clamp(18px,4.5vw,72px)] py-3.5">
        <Link href="/" className="flex items-center gap-2.5 text-xl font-black max-[379px]:gap-2 max-[379px]:text-lg">
          <span className="site-logo" aria-hidden="true" />
          Intented
        </Link>
        {/* Below 768px the landing's sections leave the header; below 480px GitHub does too and the labels shorten. */}
        <div className="flex items-center gap-6 text-[15px] text-mute max-[479px]:gap-3.5 max-[479px]:text-sm">
          <nav className="flex gap-6 max-[479px]:gap-3.5">
            <Link href="/#how" className={`${link} max-md:hidden`}>
              How it works
            </Link>
            <Link href="/#proof" className={`${link} max-md:hidden`}>
              Proof
            </Link>
            <Link href="/activity" aria-current={current === "demo" ? "page" : undefined} className={`${link} ${current === "demo" ? "text-text" : ""}`}>
              <span className="max-[479px]:hidden">Live demo</span>
              <span className="hidden max-[479px]:inline">Demo</span>
            </Link>
            <Link href="/docs" className={`${link} max-[479px]:hidden`}>
              Docs
            </Link>
            <a href={REPO} className={`${link} inline-flex items-center gap-1 max-[479px]:hidden`}>
              GitHub <ArrowUpRight className="size-3.5" />
            </a>
          </nav>
          <NetworkSwitch className="max-[899px]:hidden" />
          <Link href={IS_MAINNET ? `/wallets/${WALLET_ID}` : "/wallets"} className="rounded-full bg-lime px-4 py-2 text-sm font-bold whitespace-nowrap text-lime-ink max-[379px]:px-3">
            <span className="max-[479px]:hidden">Open the app →</span>
            <span className="hidden max-[479px]:inline">App →</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
