import { z } from "zod";
import { DEFAULT_CONSENT_TEXT, DUBAI_AREAS } from "@/lib/constants";

export const transactionTypes = ["BUY", "RENT"] as const;
export const purposes = ["INVESTMENT", "LIVING", "RELOCATION", "HOLIDAY_HOME"] as const;
export const timelines = ["0-3 months", "3-6 months", "6-12 months", "12+ months"] as const;

export const publicLeadSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().min(7).max(40).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  budgetAed: z.coerce.number().int().min(0).max(500_000_000).optional(),
  transactionType: z.enum(transactionTypes),
  propertyType: z.string().trim().min(2).max(80),
  preferredArea: z.string().trim().min(2).max(80),
  purpose: z.enum(purposes),
  timeline: z.enum(timelines),
  wantsMortgage: z.coerce.boolean().default(false),
  consent: z.boolean().refine((value) => value === true, {
    message: "Consent must be checked before a lead can be created.",
  }),
  consentText: z.string().trim().min(20).default(DEFAULT_CONSENT_TEXT),
  canContactWhatsapp: z.coerce.boolean().default(false),
  canContactEmail: z.coerce.boolean().default(false),
  canContactPhone: z.coerce.boolean().default(false),
  source: z.string().trim().min(2).max(80).default("landing"),
  sourceUrl: z.string().trim().url().optional().or(z.literal("")),
});

export const manualLeadSchema = publicLeadSchema
  .omit({ consent: true })
  .extend({
    opportunityId: z.string().trim().optional(),
    consentChannel: z.string().trim().min(2).max(80),
    consentSourceUrl: z.string().trim().url().optional().or(z.literal("")),
    consentTimestamp: z.coerce.date(),
  });

export const noteSchema = z.object({
  leadId: z.string().min(1),
  body: z.string().trim().min(2).max(2000),
});

export const followUpSchema = z.object({
  leadId: z.string().min(1),
  title: z.string().trim().min(2).max(180),
  dueDate: z.coerce.date(),
});

export const complianceSchema = z.object({
  consentText: z.string().trim().min(20).max(2000),
  privacyPolicyText: z.string().trim().min(40).max(10000),
  unsubscribeText: z.string().trim().min(20).max(2000),
  allowedContactStartHour: z.coerce.number().int().min(0).max(23),
  allowedContactEndHour: z.coerce.number().int().min(0).max(23),
  dataRetentionDays: z.coerce.number().int().min(30).max(3650),
});

export const keywordSchema = z.object({
  type: z.enum(["TARGET", "EXCLUDED", "AREA"]),
  value: z.string().trim().min(2).max(120),
});

export const sourceConfigSchema = z.object({
  platform: z.string().trim().min(1).max(40),
  enabled: z.coerce.boolean().default(false),
});

export function hasContactMethod(data: { email?: string | null; phone?: string | null; whatsapp?: string | null }) {
  return Boolean(data.email || data.phone || data.whatsapp);
}

export function normalizeArea(value: string) {
  return DUBAI_AREAS.find((area) => area.toLowerCase() === value.toLowerCase()) ?? value;
}
