import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import { REPO } from "../components/SiteHeader";
import "../components/site-header.css";
import { IS_MAINNET, WALLET_ID } from "../lib/near";
import { source } from "../lib/source";

/** The developer docs, from content/docs/. The site is dark only, so the theme switch is off. */
export default function DocsRootLayout({ children }: LayoutProps<"/docs">) {
  return (
    <RootProvider theme={{ enabled: false }}>
      <DocsLayout
        tree={source.getPageTree()}
        nav={{
          title: (
            <span className="flex items-center gap-2.5 font-bold">
              <span className="site-logo shrink-0" aria-hidden="true" />
              Intented docs
            </span>
          ),
          url: "/docs",
        }}
        // As in the site header: the mainnet build opens its one wallet.
        links={[{ text: "Open the app", url: IS_MAINNET ? `/wallets/${WALLET_ID}` : "/wallets" }]}
        githubUrl={REPO}
        themeSwitch={{ enabled: false }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
