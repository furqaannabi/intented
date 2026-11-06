import type { Metadata } from "next";
import { TestnetOnly } from "../../components/TestnetOnly";
import { IS_MAINNET } from "../../lib/near";
import { MyWallets } from "./MyWallets";

export const metadata: Metadata = {
  title: "My wallets · Intented",
  description: "The Intented wallets you own on NEAR testnet, read from the chain.",
};

export default function WalletsPage() {
  // The mainnet site has one wallet and no factory to list wallets from.
  if (IS_MAINNET) return <TestnetOnly title="My wallets" path="/wallets" />;
  return <MyWallets />;
}
