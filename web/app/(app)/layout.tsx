import { AppHeader } from "../components/AppHeader";
import { NearWalletProvider } from "../lib/useNearWallet";

/** The app (your wallets, a wallet, Create): its own header, and one NEAR wallet connection shared by the header and the page. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <NearWalletProvider>
      <div className="overflow-x-clip">
        <AppHeader />
        <main className="mx-auto max-w-[1440px] px-[clamp(16px,4.5vw,72px)]">{children}</main>
      </div>
    </NearWalletProvider>
  );
}
