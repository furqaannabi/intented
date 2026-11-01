import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { WALLET_ID } from "../lib/near";
import { Activity } from "./Activity";

export const metadata: Metadata = {
  title: "Activity · Intented",
  description: "Every payment the agent proposed, with the signed verdict, the model's reason and the on-chain result.",
};

export default function ActivityPage() {
  return (
    <div className="overflow-x-clip">
      <SiteHeader current="activity" />
      <main className="mx-auto max-w-[1440px] px-[clamp(16px,4.5vw,72px)]">
        <div className="pt-10 pb-4">
          <h1 className="text-[clamp(34px,4vw,56px)] leading-none font-black tracking-[-0.035em]">Activity</h1>
          <p className="mt-3 text-sm text-mute">
            Wallet <span className="font-mono text-text">{WALLET_ID}</span> on NEAR testnet · every verdict signed in a TEE on NEAR AI
            Cloud
          </p>
        </div>
        <Suspense fallback={<p className="py-10 text-mute">Loading payments…</p>}>
          <Activity />
        </Suspense>
      </main>
    </div>
  );
}
