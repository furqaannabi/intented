import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading, Skeleton } from "../components/Skeleton";
import { SiteHeader } from "../components/SiteHeader";
import { NearWalletProvider } from "../lib/useNearWallet";
import { Rules } from "./Rules";

export const metadata: Metadata = {
  title: "Rules · Intented",
  description: "The plain-English rules the agent's wallet enforces, checked against the hash on the contract, and the contract's own limits.",
};

export default function RulesPage() {
  return (
    <div className="overflow-x-clip">
      <SiteHeader current="demo" />
      <main className="mx-auto max-w-[1440px] px-[clamp(16px,4.5vw,72px)]">
        <Suspense
          fallback={
            <Loading label="Reading the wallet">
              <h1 className="pt-10 text-[clamp(34px,4.4vw,60px)] leading-none font-black tracking-[-0.035em]">The rules your agent pays by.</h1>
              <Skeleton className="mt-4 mb-7 h-4 w-96 max-w-full" />
              <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-7 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
                <div className="rounded-[22px] border border-line bg-ink-2 p-[clamp(20px,2.4vw,32px)]">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="mt-3 h-9 w-4/5" />
                </div>
                <div className="grid gap-4 rounded-[22px] border border-line bg-ink-2 p-6">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              </div>
            </Loading>
          }
        >
          <NearWalletProvider>
            <Rules />
          </NearWalletProvider>
        </Suspense>
      </main>
    </div>
  );
}
