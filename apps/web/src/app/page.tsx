import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Container className="flex min-h-screen flex-col items-center justify-center py-20 text-center">
        <Badge className="mb-6 uppercase tracking-[0.2em]" variant="primary">
          Powered by REVOS
        </Badge>

        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
          Reviva
        </h1>

        <p className="mt-6 text-xl text-muted sm:text-2xl">
          The AI Front Desk Employee for Med Spas
        </p>

        <p className="mt-6 max-w-2xl text-base leading-7 text-muted">
          Reviva helps Med Spas answer patient questions, capture leads, and
          create appointments around the clock.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Button>Start Building</Button>
          <Button variant="secondary">View Architecture</Button>
        </div>

        <p className="mt-10 text-sm text-subtle">
          Version 0.1.0 · Under active development
        </p>
      </Container>
    </main>
  );
}
