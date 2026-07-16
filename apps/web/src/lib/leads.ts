export const leadRoles = [
  "owner",
  "manager",
  "front-desk",
  "marketing",
  "other",
] as const;

export type LeadRole = (typeof leadRoles)[number];

export type EarlyAccessLead = {
  name: string;
  workEmail: string;
  spaName: string;
  role: LeadRole;
  website: string;
  message: string;
  consent: true;
};

type LeadValidationResult =
  | { success: true; data: EarlyAccessLead; isSpam: boolean }
  | { success: false; fieldErrors: Record<string, string> };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasValidLength(value: string, min: number, max: number) {
  return value.length >= min && value.length <= max;
}

export function validateEarlyAccessLead(input: unknown): LeadValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      fieldErrors: { form: "Submit the form using the fields provided." },
    };
  }

  const record = input as Record<string, unknown>;
  const name = readString(record.name);
  const workEmail = readString(record.workEmail).toLowerCase();
  const spaName = readString(record.spaName);
  const role = readString(record.role);
  const website = readString(record.website);
  const message = readString(record.message);
  const honeypot = readString(record.contactFax);
  const consent = record.consent === true;
  const fieldErrors: Record<string, string> = {};

  if (!hasValidLength(name, 2, 80)) {
    fieldErrors.name = "Enter your name using 2 to 80 characters.";
  }

  if (!emailPattern.test(workEmail) || workEmail.length > 254) {
    fieldErrors.workEmail = "Enter a valid work email address.";
  }

  if (!hasValidLength(spaName, 2, 120)) {
    fieldErrors.spaName = "Enter your med spa name using 2 to 120 characters.";
  }

  if (!leadRoles.includes(role as LeadRole)) {
    fieldErrors.role = "Select the role that best describes you.";
  }

  if (website.length > 200) {
    fieldErrors.website = "Keep the website address under 200 characters.";
  } else if (website) {
    try {
      const parsedWebsite = new URL(
        website.includes("://") ? website : `https://${website}`,
      );

      if (!['http:', 'https:'].includes(parsedWebsite.protocol)) {
        fieldErrors.website = "Enter a valid website address.";
      }
    } catch {
      fieldErrors.website = "Enter a valid website address.";
    }
  }

  if (message.length > 1000) {
    fieldErrors.message = "Keep the workflow description under 1,000 characters.";
  }

  if (!consent) {
    fieldErrors.consent = "Consent is required so we can respond to your request.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    isSpam: honeypot.length > 0,
    data: {
      name,
      workEmail,
      spaName,
      role: role as LeadRole,
      website,
      message,
      consent: true,
    },
  };
}

export async function deliverEarlyAccessLead(
  lead: EarlyAccessLead,
  requestId: string,
) {
  const webhookUrl = process.env.LEAD_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    throw new LeadDeliveryConfigurationError();
  }

  const parsedWebhookUrl = new URL(webhookUrl);
  const isLocalWebhook = ["localhost", "127.0.0.1"].includes(
    parsedWebhookUrl.hostname,
  );

  if (parsedWebhookUrl.protocol !== "https:" && !isLocalWebhook) {
    throw new LeadDeliveryConfigurationError();
  }

  const webhookSecret = process.env.LEAD_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    throw new LeadDeliveryConfigurationError();
  }

  const response = await fetch(parsedWebhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Reviva-Lead-Delivery/1.0",
      "x-reviva-event": "early_access.requested",
      "x-reviva-request-id": requestId,
      authorization: `Bearer ${webhookSecret}`,
    },
    body: JSON.stringify({
      event: "early_access.requested",
      requestId,
      submittedAt: new Date().toISOString(),
      source: "reviva-landing-page",
      lead,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Lead webhook returned status ${response.status}.`);
  }
}

export class LeadDeliveryConfigurationError extends Error {
  constructor() {
    super("Lead delivery is not configured correctly.");
    this.name = "LeadDeliveryConfigurationError";
  }
}
