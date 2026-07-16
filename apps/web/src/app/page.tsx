import { Container } from "@/components/layout/container";
import { EarlyAccessForm } from "@/components/marketing/early-access-form";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const capabilities = [
  {
    number: "01",
    title: "Always ready to respond",
    description:
      "Give every new inquiry a thoughtful first response, even when your team is with patients or away from the desk.",
  },
  {
    number: "02",
    title: "Built around your services",
    description:
      "Guide conversations with the treatment knowledge, policies, and tone that make your med spa distinct.",
  },
  {
    number: "03",
    title: "Designed to move forward",
    description:
      "Understand patient intent, answer common questions, and help qualified inquiries take the next step toward booking.",
  },
];

const workflow = [
  {
    step: "Listen",
    description:
      "Reviva understands what each patient is asking and captures the context behind the inquiry.",
  },
  {
    step: "Guide",
    description:
      "It responds with clear, on-brand information grounded in how your med spa operates.",
  },
  {
    step: "Advance",
    description:
      "Reviva supports the next best action, from booking intent to a thoughtful handoff to your team.",
  },
];

function BrandMark() {
  return (
    <a
      className="inline-flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      href="#top"
      aria-label="Reviva home"
    >
      <span
        className="grid size-9 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
        aria-hidden="true"
      >
        R
      </span>
      <span className="text-lg font-semibold tracking-tight">Reviva</span>
    </a>
  );
}

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 size-5 shrink-0 text-primary"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m5 10 3 3 7-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h10m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ConversationPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:mx-0 lg:ml-auto">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-primary/5 blur-2xl" aria-hidden="true" />
      <Card className="relative overflow-hidden border-border bg-surface-elevated shadow-lg">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="relative flex size-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
              R
              <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-surface-elevated bg-success" />
            </span>
            <div>
              <p className="text-sm font-semibold">Reviva Concierge</p>
              <p className="text-xs text-muted">Online now</p>
            </div>
          </div>
          <Badge variant="primary">AI employee</Badge>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-surface px-4 py-3 text-sm leading-6">
            Hi Maya — how can I help you today?
            <p className="mt-1 text-xs text-subtle">Reviva · now</p>
          </div>
          <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm border border-border bg-background px-4 py-3 text-sm leading-6">
            I&apos;m interested in a first-time facial, but I&apos;m not sure which
            treatment fits sensitive skin.
          </div>
          <div className="max-w-[90%] rounded-lg rounded-tl-sm bg-surface px-4 py-3 text-sm leading-6">
            I can help narrow that down. I&apos;ll ask two quick questions, then we
            can find the right consultation time for you.
            <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3 text-xs font-medium text-primary">
              <CheckIcon /> Ready to qualify and guide
            </div>
          </div>
        </div>

        <div className="border-t border-border-subtle bg-surface px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-sm text-subtle">
            <span>Type a message...</span>
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <ArrowIcon />
            </span>
          </div>
        </div>
      </Card>

      <div className="absolute -bottom-6 -left-3 hidden rounded-lg border border-border-subtle bg-surface px-4 py-3 shadow-md sm:flex sm:items-center sm:gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-success/10 text-success">
          <CheckIcon />
        </span>
        <div>
          <p className="text-xs font-semibold">Patient intent captured</p>
          <p className="text-xs text-muted">Context stays with the conversation</p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main id="top" className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="relative z-20 border-b border-border-subtle/80">
        <Container className="flex h-20 items-center justify-between">
          <BrandMark />
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
            <a className="nav-link" href="#capabilities">Capabilities</a>
            <a className="nav-link" href="#how-it-works">How it works</a>
            <a className="nav-link" href="#ai-employee">AI employee</a>
          </nav>
          <ButtonLink className="hidden sm:inline-flex" href="#contact">
            Request early access
          </ButtonLink>
          <a className="nav-link font-semibold text-primary sm:hidden" href="#contact">
            Early access
          </a>
        </Container>
      </header>

      <section className="relative border-b border-border-subtle/80 py-20 sm:py-28 lg:py-32">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid items-center gap-16 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12">
          <div>
            <Badge className="mb-7 uppercase tracking-[0.16em]" variant="primary">
              AI employee for med spas
            </Badge>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Every inquiry deserves a thoughtful response.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted sm:text-xl">
              Reviva is being built as a calm, capable front desk presence that
              can listen, speak, respond, and help patients move toward booking
              across text and voice.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <ButtonLink className="gap-2" href="#contact">
                Request early access <ArrowIcon />
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="secondary">See how it works</ButtonLink>
            </div>
            <div className="mt-10 flex flex-col gap-3 text-sm text-muted sm:flex-row sm:gap-6">
              <span className="flex items-center gap-2"><CheckIcon /> No missed first response</span>
              <span className="flex items-center gap-2"><CheckIcon /> Human handoff when needed</span>
            </div>
          </div>
          <ConversationPreview />
        </Container>
      </section>

      <section className="border-b border-border-subtle/80 py-8" aria-label="Reviva principles">
        <Container className="grid gap-5 text-center sm:grid-cols-3 sm:divide-x sm:divide-border-subtle">
          <p className="text-sm font-medium text-muted">Available for every inquiry</p>
          <p className="text-sm font-medium text-muted">Consistent with your med spa</p>
          <p className="text-sm font-medium text-muted">Designed for thoughtful handoff</p>
        </Container>
      </section>

      <section id="ai-employee" className="scroll-mt-20 border-b border-border-subtle/80 py-24 sm:py-32">
        <Container>
          <div className="grid items-start gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
            <div className="max-w-xl">
              <Badge className="mb-6" variant="primary">Product vision</Badge>
              <h2 className="section-title mt-0">
                One AI employee. A consistent voice and character.
              </h2>
              <p className="section-copy">
                Reviva is more than a chat window. It is being designed to
                communicate naturally, maintain a professional identity, use
                approved business knowledge, and know when a person should take
                over.
              </p>
              <p className="mt-5 text-sm leading-6 text-subtle">
                Voice and conversational automation are product direction and
                are not yet available in this early-access foundation.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <span className="mb-4 grid size-10 place-items-center rounded-md bg-primary/10 text-lg text-primary" aria-hidden="true">
                    01
                  </span>
                  <CardTitle>Natural voice</CardTitle>
                  <CardDescription className="text-base leading-7">
                    Real-time listening, speaking, interruption, and turn-taking
                    instead of a rigid phone menu.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="neutral">Planned runtime</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <span className="mb-4 grid size-10 place-items-center rounded-md bg-primary/10 text-lg text-primary" aria-hidden="true">
                    02
                  </span>
                  <CardTitle>Reliable character</CardTitle>
                  <CardDescription className="text-base leading-7">
                    A versioned role, tone, vocabulary, boundaries, and handoff
                    style that stay consistent across channels.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="neutral">Defined in framework</Badge>
                </CardContent>
              </Card>
              <Card className="sm:col-span-2">
                <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                  <div>
                    <CardTitle>Controlled action, human oversight</CardTitle>
                    <CardDescription className="mt-2 max-w-xl text-base leading-7">
                      Reviva will act only through approved, auditable tools and
                      transfer context to a human whenever judgment or care is
                      required.
                    </CardDescription>
                  </div>
                  <Badge className="mt-4 shrink-0 sm:mt-0" variant="neutral">Planned runtime</Badge>
                </CardHeader>
              </Card>
            </div>
          </div>
        </Container>
      </section>

      <section id="capabilities" className="scroll-mt-20 py-24 sm:py-32">
        <Container>
          <div className="max-w-2xl">
            <p className="eyebrow">A better first impression</p>
            <h2 className="section-title">More capacity without losing the human touch.</h2>
            <p className="section-copy">
              Reviva handles the repeatable work at the front of a conversation
              so your team can stay focused on patients who need them most.
            </p>
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {capabilities.map((capability) => (
              <Card key={capability.number} className="transition-colors hover:border-primary/30">
                <CardHeader className="pb-4">
                  <span className="mb-8 text-sm font-semibold text-primary">{capability.number}</span>
                  <CardTitle className="text-xl">{capability.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-7">{capability.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-y border-border-subtle/80 bg-surface/40 py-24 sm:py-32">
        <Container>
          <div className="grid gap-14 lg:grid-cols-[0.75fr_1.25fr] lg:gap-24">
            <div>
              <p className="eyebrow">How it works</p>
              <h2 className="section-title">One clear path from hello to next step.</h2>
              <p className="section-copy">
                Each conversation stays focused, useful, and aligned with the
                experience you want patients to have.
              </p>
            </div>
            <ol className="divide-y divide-border-subtle border-y border-border-subtle">
              {workflow.map((item, index) => (
                <li className="grid gap-4 py-7 sm:grid-cols-[3rem_9rem_1fr] sm:items-start" key={item.step}>
                  <span className="text-sm font-semibold text-primary">0{index + 1}</span>
                  <h3 className="text-lg font-semibold">{item.step}</h3>
                  <p className="leading-7 text-muted">{item.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <section id="about" className="scroll-mt-20 py-24 sm:py-32">
        <Container>
          <div className="grid overflow-hidden rounded-xl border border-border-subtle bg-surface lg:grid-cols-2">
            <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16">
              <Badge className="mb-6 w-fit" variant="primary">Technology that knows its role</Badge>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                AI when it helps. Your team when it matters.
              </h2>
              <p className="mt-6 text-lg leading-8 text-muted">
                Reviva is designed to support your front desk, not distance you
                from patients. Conversations can move to your team with the
                context already captured.
              </p>
              <ul className="mt-8 space-y-4 text-sm">
                <li className="flex gap-3"><CheckIcon /> Clear escalation paths</li>
                <li className="flex gap-3"><CheckIcon /> Conversation context preserved</li>
                <li className="flex gap-3"><CheckIcon /> Your policies remain the source of truth</li>
              </ul>
            </div>
            <div className="handoff-grid relative min-h-96 border-t border-border-subtle bg-background p-8 lg:border-l lg:border-t-0 lg:p-12">
              <div className="relative flex h-full flex-col justify-center gap-4">
                <div className="mr-12 rounded-lg border border-border bg-surface p-5 shadow-sm">
                  <p className="eyebrow text-xs">Reviva summary</p>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    New patient is exploring a first-time facial for sensitive
                    skin and would like a consultation this week.
                  </p>
                </div>
                <div className="ml-12 rounded-lg border border-primary/30 bg-primary/10 p-5 shadow-sm">
                  <p className="eyebrow text-xs">Ready for your team</p>
                  <p className="mt-3 text-sm leading-6">
                    Intent, preferences, and conversation history are organized
                    for a confident human follow-up.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section id="contact" className="scroll-mt-20 pb-24 sm:pb-32">
        <Container>
          <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-surface px-7 py-10 shadow-md sm:px-12 sm:py-14 lg:px-16 lg:py-16">
            <div className="absolute inset-x-0 top-0 mx-auto h-40 w-2/3 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
            <div className="relative grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <div>
                <p className="eyebrow">Early access</p>
                <h2 className="section-title">
                  Make every patient inquiry feel attended to.
                </h2>
                <p className="section-copy">
                  We&apos;re building Reviva with a small group of
                  forward-thinking med spas. Tell us about your front desk
                  workflow.
                </p>
                <div className="mt-8 border-t border-border-subtle pt-6 text-sm leading-6 text-muted">
                  Prefer email? Write to{" "}
                  <a className="legal-link" href="mailto:hello@reviva.ai">
                    hello@reviva.ai
                  </a>
                  .
                </div>
              </div>
              <EarlyAccessForm />
            </div>
          </div>
        </Container>
      </section>

      <footer className="border-t border-border-subtle py-10">
        <Container className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <BrandMark />
          <p className="text-sm text-subtle">A voice-capable AI Employee, built thoughtfully for med spas.</p>
          <div className="flex flex-wrap gap-5">
            <a className="nav-link" href="/privacy">Privacy</a>
            <a className="nav-link" href="/terms">Terms</a>
            <a className="nav-link" href="mailto:hello@reviva.ai">Contact</a>
          </div>
        </Container>
      </footer>
    </main>
  );
}
