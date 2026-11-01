import type { Metadata } from "next";
import { SiteHeader } from "../components/SiteHeader";
import { Rules } from "./Rules";

export const metadata: Metadata = {
  title: "Rules · Intented",
  description: "The plain-English rules the agent's wallet enforces, checked against the hash on the contract, and the contract's own limits.",
};

export default function RulesPage() {
  return (
    <div className="overflow-x-clip">
      <SiteHeader current="rules" />
      <main className="mx-auto max-w-[1440px] px-[clamp(16px,4.5vw,72px)]">
        <Rules />
      </main>
    </div>
  );
}
