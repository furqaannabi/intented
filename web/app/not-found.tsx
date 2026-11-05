import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "./components/SiteHeader";

export const metadata: Metadata = { title: "Not found · Intented" };

export default function NotFound() {
  return (
    <div className="overflow-x-clip">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-[clamp(16px,4.5vw,72px)] py-[clamp(64px,12vw,160px)]">
        <p className="font-mono text-sm text-mute">404</p>
        <h1 className="mt-3 text-[clamp(34px,4vw,56px)] leading-none font-black tracking-[-0.035em]">This page doesn&apos;t exist.</h1>
        <p className="mt-4 max-w-[34em] text-mute">The link may be old, or mistyped.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-lime-ink">
            Home
          </Link>
          <Link href="/activity" className="rounded-full border border-line px-5 py-2.5 text-sm font-bold hover:bg-ink-2">
            Live demo
          </Link>
        </div>
      </main>
    </div>
  );
}
