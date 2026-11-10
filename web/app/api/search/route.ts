import { createFromSource } from "fumadocs-core/search/server";
import { source } from "../../lib/source";

// Search for /docs. Served by this app, not proxied to the Intented API: next.config.ts proxies only the API's own paths.
export const { GET } = createFromSource(source);
