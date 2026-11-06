import type { Metadata } from "next";
import { Suspense } from "react";
import { TestnetOnly } from "../../components/TestnetOnly";
import { IS_MAINNET } from "../../lib/near";
import { CreateSkeleton, CreateWallet } from "./CreateWallet";

export const metadata: Metadata = {
  title: "Create your wallet · Intented",
  description: "Create an Intented wallet on NEAR testnet in one signed call: your rules, your limits, your agent's key, and no full-access key.",
};

export default function CreatePage() {
  // The mainnet site has no factory, so nothing to create there.
  if (IS_MAINNET) return <TestnetOnly title="Create your wallet" path="/create" />;
  return (
    <Suspense fallback={<CreateSkeleton />}>
      <CreateWallet />
    </Suspense>
  );
}
