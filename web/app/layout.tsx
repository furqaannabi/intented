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

const description =
  "A wallet for AI agents on NEAR. An AI in a secure enclave checks every payment against your rules, and the wallet pays only when it signs ALLOW.";

// The OG image is app/opengraph-image.png. Link previews need its absolute URL, so the deployed site sets SITE_URL.
export const metadata: Metadata = {
  ...(process.env.SITE_URL ? { metadataBase: new URL(process.env.SITE_URL) } : {}),
  title: "Intented",
  description,
  openGraph: { title: "Intented", description, siteName: "Intented", type: "website" },
  twitter: { card: "summary_large_image", title: "Intented", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
