import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { CreateWallet } from "./CreateWallet";

export const metadata: Metadata = {
  title: "Create your wallet · Intented",
  description: "Create an Intented wallet on NEAR testnet in one signed call: your rules, your limits, your agent's key, and no full-access key.",
};

export default function CreatePage() {
  return (
    <div className="overflow-x-clip">
      <SiteHeader current="create" />
      <main className="mx-auto max-w-[1440px] px-[clamp(16px,4.5vw,72px)]">
        <Suspense fallback={<p className="py-10 text-mute">Loading…</p>}>
          <CreateWallet />
        </Suspense>
      </main>
    </div>
  );
}
