import { NextRequest, NextResponse } from "next/server";
import { metaFieldsToRecord, metaLeadPayloadSchema, verifyMetaWebhookToken } from "@/lib/sources/meta";
import { createConsentedLead } from "@/lib/leads";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (verifyMetaWebhookToken(token) && challenge) {
    return new NextResponse(challenge);
  }
  return NextResponse.json({ ok: false, error: "Invalid verification token." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret") || request.nextUrl.searchParams.get("secret");
  if (!verifyMetaWebhookToken(secret)) {
    return NextResponse.json({ ok: false, error: "Invalid webhook secret." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const payloads = extractPayloads(body);
  let created = 0;
  const errors: string[] = [];

  for (const payload of payloads) {
    const parsed = metaLeadPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      errors.push("Invalid Meta lead payload shape.");
      continue;
    }
    if (!parsed.data.consent?.text || !parsed.data.consent.source) {
      errors.push("Meta lead ignored because consent text/source metadata is missing.");
      continue;
    }

    const fields = metaFieldsToRecord(parsed.data.field_data);
    const result = await createConsentedLead({
      fullName: fields.full_name || fields.name || "Meta Lead",
      email: fields.email,
      phone: fields.phone_number || fields.phone,
      whatsapp: fields.whatsapp || fields.phone_number || fields.phone,
      budgetAed: fields.budget_aed ? Number(fields.budget_aed) : undefined,
      transactionType: fields.transaction_type?.toUpperCase() === "RENT" ? "RENT" : "BUY",
      propertyType: fields.property_type || "Apartment",
      preferredArea: fields.preferred_area || "Dubai Marina",
      purpose: normalizePurpose(fields.purpose),
      timeline: fields.timeline || "3-6 months",
      wantsMortgage: /yes|true|mortgage/i.test(fields.wants_mortgage || ""),
      source: "Meta Lead Ads",
      sourceUrl: parsed.data.consent.source,
      consentText: parsed.data.consent.text,
      consentChannel: "Meta Lead Ads",
      consentSourceUrl: parsed.data.consent.source,
      consentTimestamp: parsed.data.consent.timestamp ? new Date(parsed.data.consent.timestamp) : new Date(parsed.data.created_time || Date.now()),
      canContactEmail: parsed.data.consent.canContactEmail ?? Boolean(fields.email),
      canContactPhone: parsed.data.consent.canContactPhone ?? Boolean(fields.phone_number || fields.phone),
      canContactWhatsapp: parsed.data.consent.canContactWhatsapp ?? Boolean(fields.whatsapp || fields.phone_number || fields.phone),
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    if (result.ok) created += 1;
    else errors.push(result.error);
  }

  return NextResponse.json({ ok: errors.length === 0, created, errors });
}

function extractPayloads(body: unknown): unknown[] {
  if (!body || typeof body !== "object") return [];
  const direct = metaLeadPayloadSchema.safeParse(body);
  if (direct.success) return [body];

  const entry = (body as { entry?: Array<{ changes?: Array<{ value?: unknown }> }> }).entry;
  return entry?.flatMap((item) => item.changes?.map((change) => change.value).filter(Boolean) ?? []) ?? [];
}

function normalizePurpose(value?: string): "INVESTMENT" | "LIVING" | "RELOCATION" | "HOLIDAY_HOME" {
  const normalized = (value || "").toUpperCase().replaceAll(" ", "_");
  if (["INVESTMENT", "LIVING", "RELOCATION", "HOLIDAY_HOME"].includes(normalized)) {
    return normalized as "INVESTMENT" | "LIVING" | "RELOCATION" | "HOLIDAY_HOME";
  }
  return "INVESTMENT";
}
