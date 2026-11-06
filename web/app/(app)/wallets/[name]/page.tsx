import type { Metadata } from "next";
import { NETWORK_NAME } from "../../../lib/near";
import { Suspense } from "react";
import { WalletRoute, WalletSkeleton } from "./WalletPage";

// Static, so nothing here reads the URL; the page sets the wallet's name as the title itself.
export const metadata: Metadata = {
  title: "Wallet · Intented",
  description: `An Intented wallet on ${NETWORK_NAME}: its rules, limits, balance and agent keys, read from the chain.`,
};

// The wallet is read in the browser, so the page itself has nothing to wait for: the name comes from useParams.
export default function Page() {
  return (
    <Suspense fallback={<WalletSkeleton walletId={null} />}>
      <WalletRoute />
    </Suspense>
  );
}
