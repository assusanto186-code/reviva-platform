import type { Metadata } from "next";

import { LegalDocument } from "@/components/layout/legal-document";

export const metadata: Metadata = {
  title: "Privacy Notice — Reviva",
  description:
    "How Reviva handles information submitted through its pre-launch website and early-access form.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Pre-launch website"
      title="Privacy Notice"
      summary="This notice explains how Reviva handles information submitted through this website and early-access form. Product and patient-data practices will be covered by separate, reviewed notices before any customer pilot."
      updated="July 14, 2026"
    >
      <h2>Information we collect</h2>
      <p>
        When you request early access, we collect the contact and business
        information you choose to provide, such as your name, work email, med
        spa name, role, website, and description of your front desk workflow.
        Please do not submit patient, medical, payment, or other sensitive
        information through this form.
      </p>
      <p>
        We may also process limited technical information needed to deliver and
        protect the form, including request time, request identifier, IP-derived
        rate-limit information, and standard request headers. The application
        does not currently install non-essential analytics or advertising
        cookies.
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>Respond to your early-access request and communicate about Reviva.</li>
        <li>Understand product demand and relevant med spa workflows.</li>
        <li>Protect the form, investigate delivery failures, and prevent abuse.</li>
        <li>Comply with applicable obligations and enforce website terms.</li>
      </ul>

      <h2>Delivery and service providers</h2>
      <p>
        Form submissions are sent server-to-server to the lead-delivery service
        configured by Reviva. We may use hosting, communications, and business
        service providers that process information on our behalf. We do not sell
        early-access contact information or use it for third-party advertising.
      </p>

      <h2>Retention and security</h2>
      <p>
        We retain early-access information only as long as reasonably needed for
        the purposes above, operational records, and applicable obligations.
        We use access controls and transport security appropriate to the
        pre-launch workflow, but no internet service can guarantee absolute
        security.
      </p>

      <h2>Your choices</h2>
      <p>
        You may ask us to update or delete your early-access information, or ask
        us to stop contacting you. Some information may be retained where
        required for security, legal, or operational records.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update this notice as the website and product evolve. Material
        product-data practices will be documented before pilot use. Questions
        or requests can be sent to{" "}
        <a href="mailto:hello@reviva.ai">hello@reviva.ai</a>.
      </p>
    </LegalDocument>
  );
}
