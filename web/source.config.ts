import { defineConfig, defineDocs } from "fumadocs-mdx/config";

// The developer docs live in content/docs/ and are served at /docs
// (decisions/2026-11-10-docs-in-the-web-app.md).
export const docs = defineDocs({
  dir: "content/docs",
  // Only meta.json orders the sidebar; openapi.yaml is read by the API reference, not as a sidebar file.
  meta: { files: ["**/meta.json"] },
});

export default defineConfig();
