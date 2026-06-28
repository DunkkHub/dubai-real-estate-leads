import { z } from "zod";

export const consentProofSchema = z.object({
  consentText: z.string().trim().min(20, "Consent text must be the exact text shown to the user."),
  consentChannel: z.string().trim().min(2, "Consent channel is required."),
  consentSourceUrl: z.string().trim().url().optional().or(z.literal("")),
  consentTimestamp: z.coerce.date(),
  canContactWhatsapp: z.coerce.boolean().default(false),
  canContactEmail: z.coerce.boolean().default(false),
  canContactPhone: z.coerce.boolean().default(false),
});

export type ConsentProofInput = z.infer<typeof consentProofSchema>;

export function validateConsentProof(input: unknown) {
  const parsed = consentProofSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const proof = parsed.data;
  if (!proof.canContactEmail && !proof.canContactPhone && !proof.canContactWhatsapp) {
    return {
      ok: false as const,
      errors: ["At least one contact channel must be explicitly consented."],
    };
  }

  if (proof.consentTimestamp.getTime() > Date.now() + 60_000) {
    return {
      ok: false as const,
      errors: ["Consent timestamp cannot be in the future."],
    };
  }

  return { ok: true as const, data: proof };
}

export function requireCheckedConsent(consent: boolean, consentText?: string) {
  if (!consent) {
    return { ok: false as const, error: "Consent checkbox must be checked before a lead is created." };
  }
  if (!consentText || consentText.trim().length < 20) {
    return { ok: false as const, error: "Exact consent text is required." };
  }
  return { ok: true as const };
}
