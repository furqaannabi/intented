"use client";

import { useRef, useState } from "react";
import { LABEL } from "../lib/near";
import { REPO } from "./SiteHeader";

/**
 * Where an agent's key comes from: `intented init`, run on the agent's machine. It keeps the private key there,
 * so the page only ever asks for the public half. For now it runs from a checkout of this repo.
 */
export function InitCommand({ name, then }: { name: string; then: string }) {
  const cmd = `pnpm intented init ${LABEL.test(name) ? name : "<name>"}`;
  const code = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState<"" | "copied" | "selected">("");

  // Some browsers refuse clipboard writes; then the command is selected so it can be copied by hand.
  const copy = () => {
    const show = (state: "copied" | "selected") => {
      setCopied(state);
      setTimeout(() => setCopied(""), 2400);
    };
    navigator.clipboard.writeText(cmd).then(
      () => show("copied"),
      () => {
        if (code.current) window.getSelection()?.selectAllChildren(code.current);
        show("selected");
      },
    );
  };

  return (
    <div className="mt-3 rounded-[12px] border border-line bg-ink px-3.5 py-3 text-[13px] text-mute">
      <p>
        <b className="font-bold text-text">No key yet?</b> On the machine your agent runs on, in the{" "}
        <a href={`${REPO}/tree/main/agent`} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:text-text">
          agent folder of the Intented repo
        </a>
        :
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code ref={code} className="min-w-[12rem] flex-1 rounded-[8px] [overflow-wrap:anywhere] bg-black/40 px-2.5 py-1.5 font-mono text-[12.5px] text-text">{cmd}</code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-full border-[1.5px] border-line px-3 py-1 text-[12.5px] font-bold text-text transition-colors hover:border-soft"
        >
          <span aria-live="polite">{copied === "copied" ? "Copied" : copied === "selected" ? "Selected: copy it" : "Copy"}</span>
        </button>
      </div>
      <p className="mt-2">It keeps the private key on that machine and {then}</p>
    </div>
  );
}
