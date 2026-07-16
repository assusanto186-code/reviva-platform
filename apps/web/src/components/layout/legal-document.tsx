import type { ReactNode } from "react";
import Link from "next/link";

import { Container } from "@/components/layout/container";

type LegalDocumentProps = {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  children: ReactNode;
};

export function LegalDocument({
  eyebrow,
  title,
  summary,
  updated,
  children,
}: LegalDocumentProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border-subtle">
        <Container className="flex h-20 items-center justify-between">
          <Link
            className="inline-flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            href="/"
            aria-label="Back to Reviva home"
          >
            <span
              className="grid size-9 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
              aria-hidden="true"
            >
              R
            </span>
            <span className="text-lg font-semibold tracking-tight">Reviva</span>
          </Link>
          <Link className="nav-link" href="/">
            Back to home
          </Link>
        </Container>
      </header>

      <Container className="py-16 sm:py-24">
        <article className="mx-auto max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted">{summary}</p>
          <p className="mt-5 text-sm text-subtle">Last updated: {updated}</p>
          <div className="legal-document mt-12 border-t border-border-subtle pt-10">
            {children}
          </div>
        </article>
      </Container>

      <footer className="border-t border-border-subtle py-8">
        <Container className="flex flex-col gap-4 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>Reviva · AI Employee Platform powered by REVOS</p>
          <div className="flex gap-5">
            <Link className="nav-link" href="/privacy">
              Privacy
            </Link>
            <Link className="nav-link" href="/terms">
              Terms
            </Link>
          </div>
        </Container>
      </footer>
    </main>
  );
}
