import { NextRequest, NextResponse } from "next/server";

import {
  deliverEarlyAccessLead,
  LeadDeliveryConfigurationError,
  validateEarlyAccessLead,
} from "@/lib/leads";

export const runtime = "nodejs";

const requestWindowMs = 15 * 60 * 1000;
const requestLimit = 5;
const maximumTrackedClients = 1_000;
const requestLog = new Map<string, number[]>();

function getClientAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(clientAddress: string) {
  const now = Date.now();

  if (requestLog.size >= maximumTrackedClients) {
    for (const [address, timestamps] of requestLog) {
      if (timestamps.every((timestamp) => now - timestamp >= requestWindowMs)) {
        requestLog.delete(address);
      }
    }

    while (requestLog.size >= maximumTrackedClients) {
      const oldestAddress = requestLog.keys().next().value;

      if (typeof oldestAddress !== "string") {
        break;
      }

      requestLog.delete(oldestAddress);
    }
  }

  const recentRequests = (requestLog.get(clientAddress) ?? []).filter(
    (timestamp) => now - timestamp < requestWindowMs,
  );

  recentRequests.push(now);
  requestLog.set(clientAddress, recentRequests);

  return recentRequests.length > requestLimit;
}

function hasAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const configuredOrigin = process.env.LEAD_ALLOWED_ORIGIN?.trim();

  try {
    const requestOrigin = new URL(origin).origin;
    const allowedOrigin = configuredOrigin
      ? new URL(configuredOrigin).origin
      : request.nextUrl.origin;

    return requestOrigin === allowedOrigin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  if (!hasAllowedOrigin(request)) {
    return NextResponse.json(
      { success: false, message: "This request origin is not allowed." },
      { status: 403 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (contentLength > 20_000) {
    return NextResponse.json(
      { success: false, message: "The submitted form is too large." },
      { status: 413 },
    );
  }

  const clientAddress = getClientAddress(request);

  if (isRateLimited(clientAddress)) {
    return NextResponse.json(
      {
        success: false,
        message: "Too many requests. Please wait before trying again.",
      },
      { status: 429, headers: { "retry-after": "900" } },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Submit valid JSON form data." },
      { status: 400 },
    );
  }

  const validation = validateEarlyAccessLead(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Review the highlighted fields and try again.",
        fieldErrors: validation.fieldErrors,
      },
      { status: 400 },
    );
  }

  if (validation.isSpam) {
    return NextResponse.json({ success: true, requestId }, { status: 202 });
  }

  try {
    await deliverEarlyAccessLead(validation.data, requestId);

    return NextResponse.json({ success: true, requestId }, { status: 201 });
  } catch (error) {
    if (error instanceof LeadDeliveryConfigurationError) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Early access delivery is not configured yet. Please email hello@reviva.ai.",
        },
        { status: 503 },
      );
    }

    console.error("Early access delivery failed.", { requestId });

    return NextResponse.json(
      {
        success: false,
        message:
          "We could not deliver your request right now. Please email hello@reviva.ai.",
      },
      { status: 502 },
    );
  }
}
