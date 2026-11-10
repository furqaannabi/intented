import { loader } from "fumadocs-core/source";
import { docs } from "../../.source/server";

/** The developer docs from content/docs/, served at /docs. */
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
