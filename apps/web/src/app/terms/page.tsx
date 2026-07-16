import type { Metadata } from "next";

import { LegalDocument } from "@/components/layout/legal-document";

export const metadata: Metadata = {
  title: "Website Terms — Reviva",
  description: "Terms for using the Reviva pre-launch website.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Pre-launch website"
      title="Website Terms"
      summary="These terms apply to this informational website and its early-access workflow. They do not create a subscription to the Reviva product or authorize use with patient information."
      updated="July 14, 2026"
    >
      <h2>Pre-launch information</h2>
      <p>
        Reviva is under development. Website descriptions marked as product
        vision, planned runtime, or early access describe intended direction and
        may change. Submitting an early-access request does not guarantee access,
        availability, pricing, features, or a launch date.
      </p>

      <h2>Permitted use</h2>
      <p>
        You may use this website to learn about Reviva and contact us about a
        legitimate business interest. You may not attempt to disrupt the site,
        bypass its safeguards, submit unlawful content, impersonate another
        person, or use automated means to abuse the form.
      </p>

      <h2>No medical service</h2>
      <p>
        This website does not provide medical advice, diagnosis, treatment,
        emergency support, or a patient communication service. Do not submit
        patient or medical information through the early-access form.
      </p>

      <h2>Intellectual property</h2>
      <p>
        The Reviva and REVOS names, product materials, interface, and website
        content are owned by Reviva or its licensors. These terms do not grant a
        license to copy, modify, distribute, or commercially exploit them.
      </p>

      <h2>Availability and external services</h2>
      <p>
        We may change, suspend, or discontinue this pre-launch website. Email,
        hosting, and lead-delivery services may be operated by third parties and
        can experience interruptions outside our control.
      </p>

      <h2>Disclaimers and responsibility</h2>
      <p>
        The website is provided for general informational purposes on an
        as-available basis. To the extent permitted by applicable law, Reviva is
        not responsible for indirect or consequential loss resulting from use
        of, or inability to use, this pre-launch website.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms as the website evolves. Product access will
        have a separate agreement before customer use. Questions can be sent to{" "}
        <a href="mailto:hello@reviva.ai">hello@reviva.ai</a>.
      </p>
    </LegalDocument>
  );
}
