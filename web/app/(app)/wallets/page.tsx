import type { Metadata } from "next";
import { MyWallets } from "./MyWallets";

export const metadata: Metadata = {
  title: "My wallets · Intented",
  description: "The Intented wallets you own on NEAR testnet, read from the chain.",
};

export default function WalletsPage() {
  return <MyWallets />;
}
