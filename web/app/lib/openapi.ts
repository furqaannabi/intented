import { createOpenAPI } from "fumadocs-openapi/server";

/** The Intented API's OpenAPI file, for the HTTP API pages in /docs. Paths are relative to web/. */
export const openapi = createOpenAPI({ input: ["./content/docs/openapi.yaml"] });
