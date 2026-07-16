"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormResponse = {
  success: boolean;
  message?: string;
  requestId?: string;
  fieldErrors?: Record<string, string>;
};

type SubmissionStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; requestId?: string }
  | { kind: "error"; message: string };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-2 text-sm text-danger" id={id}>
      {message}
    </p>
  );
}

export function EarlyAccessForm() {
  const [status, setStatus] = useState<SubmissionStatus>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "submitting" });
    setFieldErrors({});

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      workEmail: formData.get("workEmail"),
      spaName: formData.get("spaName"),
      role: formData.get("role"),
      website: formData.get("website"),
      message: formData.get("message"),
      contactFax: formData.get("contactFax"),
      consent: formData.get("consent") === "on",
    };

    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as FormResponse;

      if (!response.ok || !result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        setStatus({
          kind: "error",
          message:
            result.message ??
            "We could not submit your request. Please try again.",
        });
        return;
      }

      form.reset();
      setStatus({ kind: "success", requestId: result.requestId });
    } catch {
      setStatus({
        kind: "error",
        message:
          "We could not reach Reviva right now. Please email hello@reviva.ai.",
      });
    }
  }

  if (status.kind === "success") {
    return (
      <div
        className="rounded-lg border border-success/30 bg-success/10 p-6 text-left"
        role="status"
      >
        <p className="text-lg font-semibold text-foreground">
          Your request is on its way.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Thank you for telling us about your med spa. The Reviva team will
          follow up using the email you provided.
        </p>
        {status.requestId ? (
          <p className="mt-4 text-xs text-subtle">
            Reference: {status.requestId}
          </p>
        ) : null}
        <button
          className="mt-5 rounded-sm text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
        >
          Submit another request
        </button>
      </div>
    );
  }

  const isSubmitting = status.kind === "submitting";

  return (
    <form className="space-y-5 text-left" onSubmit={handleSubmit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="early-access-name">
            Your name
          </label>
          <Input
            id="early-access-name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
          />
          <FieldError id="name-error" message={fieldErrors.name} />
        </div>
        <div>
          <label className="form-label" htmlFor="early-access-email">
            Work email
          </label>
          <Input
            id="early-access-email"
            name="workEmail"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            aria-invalid={Boolean(fieldErrors.workEmail)}
            aria-describedby={
              fieldErrors.workEmail ? "work-email-error" : undefined
            }
          />
          <FieldError
            id="work-email-error"
            message={fieldErrors.workEmail}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="early-access-spa">
            Med spa name
          </label>
          <Input
            id="early-access-spa"
            name="spaName"
            autoComplete="organization"
            required
            minLength={2}
            maxLength={120}
            aria-invalid={Boolean(fieldErrors.spaName)}
            aria-describedby={fieldErrors.spaName ? "spa-name-error" : undefined}
          />
          <FieldError id="spa-name-error" message={fieldErrors.spaName} />
        </div>
        <div>
          <label className="form-label" htmlFor="early-access-role">
            Your role
          </label>
          <select
            className="form-select"
            id="early-access-role"
            name="role"
            required
            defaultValue=""
            aria-invalid={Boolean(fieldErrors.role)}
            aria-describedby={fieldErrors.role ? "role-error" : undefined}
          >
            <option disabled value="">
              Select a role
            </option>
            <option value="owner">Owner or founder</option>
            <option value="manager">Practice manager</option>
            <option value="front-desk">Front desk team</option>
            <option value="marketing">Marketing or growth</option>
            <option value="other">Other</option>
          </select>
          <FieldError id="role-error" message={fieldErrors.role} />
        </div>
      </div>

      <div>
        <label className="form-label" htmlFor="early-access-website">
          Website <span className="font-normal text-subtle">(optional)</span>
        </label>
        <Input
          id="early-access-website"
          name="website"
          type="text"
          inputMode="url"
          autoComplete="url"
          maxLength={200}
          placeholder="yourmedspa.com"
          aria-invalid={Boolean(fieldErrors.website)}
          aria-describedby={fieldErrors.website ? "website-error" : undefined}
        />
        <FieldError id="website-error" message={fieldErrors.website} />
      </div>

      <div>
        <label className="form-label" htmlFor="early-access-message">
          What should Reviva help your team handle?{" "}
          <span className="font-normal text-subtle">(optional)</span>
        </label>
        <textarea
          className="form-textarea"
          id="early-access-message"
          name="message"
          rows={4}
          maxLength={1000}
          placeholder="Tell us about your inquiry, booking, or front desk workflow."
          aria-invalid={Boolean(fieldErrors.message)}
          aria-describedby={fieldErrors.message ? "message-error" : undefined}
        />
        <FieldError id="message-error" message={fieldErrors.message} />
      </div>

      <div className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true">
        <label htmlFor="early-access-fax">Fax number</label>
        <input
          id="early-access-fax"
          name="contactFax"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm leading-6 text-muted">
          <input
            className="mt-1 size-4 shrink-0 accent-primary"
            name="consent"
            type="checkbox"
            required
            aria-invalid={Boolean(fieldErrors.consent)}
            aria-describedby={fieldErrors.consent ? "consent-error" : undefined}
          />
          <span>
            I agree that Reviva may use this information to respond to my early
            access request as described in the{" "}
            <a className="legal-link" href="/privacy">
              Privacy Notice
            </a>
            .
          </span>
        </label>
        <FieldError id="consent-error" message={fieldErrors.consent} />
      </div>

      {status.kind === "error" ? (
        <div
          className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm leading-6 text-foreground"
          role="alert"
        >
          {status.message}{" "}
          <a className="font-semibold text-primary underline" href="mailto:hello@reviva.ai">
            Email us directly
          </a>
          .
        </div>
      ) : null}

      <Button className="w-full sm:w-auto" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Submitting..." : "Request early access"}
      </Button>
      <p className="text-xs leading-5 text-subtle">
        No patient or medical information. This form is only for med spa
        operators interested in Reviva.
      </p>
    </form>
  );
}
