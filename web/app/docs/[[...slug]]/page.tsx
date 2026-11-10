import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { openapi } from "../../lib/openapi";
import { source } from "../../lib/source";
import { mdxComponents } from "../mdx-components";

export default async function Page({ params }: PageProps<"/docs/[[...slug]]">) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  const Body = page.data.body;
  // An HTTP API page names the OpenAPI documents it shows; they're loaded here, on the server.
  const preload = (page.data as { _openapi?: { preload?: string[] } })._openapi?.preload ?? [];
  const openapiDocs = Object.fromEntries(await Promise.all(preload.map(async (id) => [id, (await openapi.getSchema(id)).bundled])));
  return (
    <DocsPage toc={page.data.toc} full={(page.data as { full?: boolean }).full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <Body components={mdxComponents(openapiDocs)} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: PageProps<"/docs/[[...slug]]">): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  return { title: `${page.data.title} · Intented docs`, description: page.data.description };
}
