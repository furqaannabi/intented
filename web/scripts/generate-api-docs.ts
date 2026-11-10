// Writes one page per endpoint of content/docs/openapi.yaml into content/docs/reference/http/.
// Run from web/ after changing openapi.yaml: `node scripts/generate-api-docs.ts`. The pages are committed.
import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

await generateFiles({
  input: createOpenAPI({ input: ["./content/docs/openapi.yaml"] }),
  output: "./content/docs/reference/http",
  per: "operation",
  includeDescription: true,
  // Flat names, method first: api/proposals/id/get.mdx becomes get-proposals-id.mdx.
  beforeWrite(files) {
    for (const file of files) {
      const parts = file.path.replace(/\\/g, "/").split("/");
      const at = parts.lastIndexOf("api");
      const method = parts.at(-1)!.replace(/\.mdx$/, "");
      parts.splice(at, Infinity, `${method}-${parts.slice(at + 1, -1).join("-")}.mdx`);
      file.path = parts.join("/");
    }
  },
});
