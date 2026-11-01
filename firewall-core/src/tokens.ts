export type Network = "testnet" | "mainnet";

export interface KnownToken {
  contract: string;
  symbol: string;
  decimals: number;
}

/**
 * Token contracts the firewall vouches for, so the model can tell real USDC
 * from a look-alike. Symbol and decimals as each contract's ft_metadata
 * reported on 2026-11-01. A token transfer on any other contract is denied.
 */
export const KNOWN_TOKENS: Record<Network, readonly KnownToken[]> = {
  testnet: [
    { contract: "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af", symbol: "USDC", decimals: 6 },
    { contract: "usdc.fakes.testnet", symbol: "USDC.e", decimals: 6 },
    { contract: "wrap.testnet", symbol: "wNEAR", decimals: 24 },
  ],
  mainnet: [
    { contract: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", symbol: "USDC", decimals: 6 },
    { contract: "usdt.tether-token.near", symbol: "USDt", decimals: 6 },
    { contract: "wrap.near", symbol: "wNEAR", decimals: 24 },
  ],
};
