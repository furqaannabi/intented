// Bundles the package into dist/: our code (this folder, agent/'s init, pay and wallet, base58 from api/, and the
// firewall core's chain client and token table) in, third-party packages left as dependencies.
import { copyFileSync, rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });
const shared = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["near-api-js", "near-api-js/*", "@modelcontextprotocol/sdk", "@modelcontextprotocol/sdk/*", "zod", "zod/*"],
  alias: { "@intented/firewall-core": "./src/firewall-core-shim.ts" },
  legalComments: "none",
  logLevel: "warning",
};
await build({ ...shared, entryPoints: ["src/index.ts"], outfile: "dist/index.js" });
await build({ ...shared, entryPoints: ["src/cli.ts"], outfile: "dist/cli.js", banner: { js: "#!/usr/bin/env node" } });
copyFileSync("types/index.d.ts", "dist/index.d.ts");
console.log("built dist/index.js, dist/cli.js, dist/index.d.ts");
