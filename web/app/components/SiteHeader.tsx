import Link from "next/link";
import { ArrowUpRight } from "./icons";
import "./site-header.css";

export const REPO = "https://github.com/furqaannabi/intented";

const LINKS = [
  { href: "/#how", label: "How it works", page: "home" },
  { href: "/#proof", label: "Proof", page: "home" },
  { href: "/activity", label: "Activity", page: "activity" },
  { href: "/rules", label: "Rules", page: "rules" },
] as const;

export function SiteHeader({ current }: { current?: "home" | "activity" | "rules" }) {
  return (
    <header className="site-header sticky top-0 z-50">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-[clamp(18px,4.5vw,72px)] py-4">
        <Link href="/" className="flex items-center gap-2.5 text-xl font-black max-[379px]:gap-2 max-[379px]:text-lg">
          <span className="site-logo" aria-hidden="true" />
          Intented
        </Link>
        {/* Below 380px (a 320px phone) the nav tightens so GitHub stays on screen. Links get taller tap areas without moving the layout. */}
        <nav className="flex gap-6 text-[15px] text-mute max-[379px]:gap-3.5 max-[379px]:text-sm">
          {LINKS.map((link) => {
            const active = current !== "home" && link.page === current;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`-my-2 py-2 hover:text-text ${active ? "text-text" : ""} ${link.page === "home" ? "hidden md:inline" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
          <a href={REPO} className="-my-2 inline-flex items-center gap-1 py-2 hover:text-text">
            GitHub <ArrowUpRight className="size-3.5 max-[379px]:hidden" />
          </a>
        </nav>
      </div>
    </header>
  );
}
