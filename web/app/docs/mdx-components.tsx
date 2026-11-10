import { Callout } from "fumadocs-ui/components/callout";
import { Card as FdCard, Cards } from "fumadocs-ui/components/card";
import { Step as FdStep, Steps } from "fumadocs-ui/components/steps";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps, ReactNode } from "react";
import { OpenAPIPage } from "./OpenAPIPage";

// The content/docs/ pages were written for Mintlify; these map its components onto Fumadocs' so the pages keep their text
// (decisions/2026-11-10-docs-in-the-web-app.md). Mintlify's icon names have no equivalent here and are dropped.

function Step({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <FdStep>
      {title && <h3>{title}</h3>}
      {children}
    </FdStep>
  );
}

function Card({ title, href, children }: { title: string; href?: string; icon?: string; children?: ReactNode }) {
  // As children, not `description`: MDX already wraps the text in a <p>, and `description` would wrap it in another.
  return (
    <FdCard title={title} href={href} className="[&_p]:my-0 [&_p]:text-sm [&_p]:text-fd-muted-foreground">
      {children}
    </FdCard>
  );
}

function CardGroup({ children }: { cols?: number; children: ReactNode }) {
  return <Cards>{children}</Cards>;
}

/** Mintlify shows a CodeGroup's blocks as tabs; here they stack, each with its title. */
function CodeGroup({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

/** `openapiDocs`: the OpenAPI documents an endpoint page needs, loaded on the server, keyed as the page names them. */
export function mdxComponents(openapiDocs: Record<string, unknown> = {}): MDXComponents {
  return {
    ...defaultMdxComponents,
    Note: ({ children }: { children: ReactNode }) => <Callout type="info">{children}</Callout>,
    Info: ({ children }: { children: ReactNode }) => <Callout type="info">{children}</Callout>,
    Tip: ({ children }: { children: ReactNode }) => <Callout type="idea">{children}</Callout>,
    Warning: ({ children }: { children: ReactNode }) => <Callout type="warning">{children}</Callout>,
    Steps,
    Step,
    Card,
    CardGroup,
    CodeGroup,
    OpenAPIPage: (props: Omit<ComponentProps<typeof OpenAPIPage>, "preloaded">) => (
      <OpenAPIPage {...(props as ComponentProps<typeof OpenAPIPage>)} preloaded={{ docs: openapiDocs as never }} />
    ),
  };
}
