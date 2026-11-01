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
        <Link href="/" className="flex items-center gap-2.5 text-xl font-black">
          <span className="site-logo" aria-hidden="true" />
          Intented
        </Link>
        <nav className="flex gap-6 text-[15px] text-mute">
          {LINKS.map((link) => {
            const active = current !== "home" && link.page === current;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`hover:text-text ${active ? "text-text" : ""} ${link.page === "home" ? "hidden md:inline" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
          <a href={REPO} className="inline-flex items-center gap-1 hover:text-text">
            GitHub <ArrowUpRight className="size-3.5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
