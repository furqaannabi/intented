"use client";

import { createOpenAPIPage } from "fumadocs-openapi/ui";

/**
 * One HTTP API endpoint, from openapi.yaml (the pages in content/docs/reference/http/, written by
 * scripts/generate-api-docs.ts). A client component in this version, so the page loads the document on the server
 * and passes it in as `preloaded`. No playground: the docs don't send requests to the hosted API
 * (decisions/2026-11-10-docs-in-the-web-app.md).
 */
export const OpenAPIPage = createOpenAPIPage({ playground: { enabled: false } });
