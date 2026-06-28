import { NextRequest, NextResponse } from "next/server";
import { createConsentedLead } from "@/lib/leads";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { requireCheckedConsent } from "@/lib/consent";
import { publicLeadSchema } from "@/lib/validators/lead";

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const limit = rateLimit(`public-lead:${ip}`, 6, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many submissions. Please try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = publicLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid form data." }, { status: 400 });
  }

  const checked = requireCheckedConsent(parsed.data.consent, parsed.data.consentText);
  if (!checked.ok) {
    return NextResponse.json({ ok: false, error: checked.error }, { status: 400 });
  }

  const result = await createConsentedLead({
    ...parsed.data,
    consentChannel: parsed.data.source === "calculator" ? "ROI calculator form" : "Landing page form",
    consentSourceUrl: parsed.data.sourceUrl || request.nextUrl.href,
    consentTimestamp: new Date(),
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
    canContactEmail: parsed.data.canContactEmail || Boolean(parsed.data.email),
    canContactPhone: parsed.data.canContactPhone || Boolean(parsed.data.phone),
    canContactWhatsapp: parsed.data.canContactWhatsapp || Boolean(parsed.data.whatsapp),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, leadId: result.lead.id });
}
