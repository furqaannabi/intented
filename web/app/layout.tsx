import type { Metadata } from "next";
import { Martian_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const mono = Martian_Mono({
  variable: "--font-martian",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Intented",
  description:
    "A wallet for AI agents on NEAR. An AI in a secure enclave checks every payment against your rules, and the wallet pays only when it signs ALLOW.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
