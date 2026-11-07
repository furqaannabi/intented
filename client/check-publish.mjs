// Run before `npm publish` (prepublishOnly): refuses a build whose default API or site is localhost, which would work
// for nobody who installs it. Set the hosted URLs in src/index.ts first.
import { readFileSync } from "node:fs";

const local = /https?:\/\/(localhost|127\.0\.0\.1)\b/;
const bad = ["dist/index.js", "dist/cli.js"].filter((f) => local.test(readFileSync(f, "utf8")));
if (bad.length) {
  console.error(`not publishing: ${bad.join(" and ")} still default to localhost. Set the hosted API and site URLs in src/index.ts.`);
  process.exit(1);
}
console.log("no localhost defaults in dist/");
