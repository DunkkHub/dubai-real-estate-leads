import { z } from "zod";
import { notConfigured } from "@/lib/sources/shared";
import type { SourceFetchResult } from "@/lib/sources/types";

export function metaStatus(): SourceFetchResult {
  const missing = ["META_APP_ID", "META_APP_SECRET", "META_WEBHOOK_VERIFY_TOKEN"].filter((key) => !process.env[key]);
  if (missing.length) return notConfigured("Meta", missing);
  return {
    configured: true,
    status: "configured",
    message: "Meta webhook credentials are configured. Use /api/webhooks/meta-leads for Lead Ads payloads.",
    opportunities: [],
  };
}

export function verifyMetaWebhookToken(token: string | null) {
  return Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN && token === process.env.META_WEBHOOK_VERIFY_TOKEN);
}

const metaFieldSchema = z.object({
  name: z.string(),
  values: z.array(z.string()),
});

export const metaLeadPayloadSchema = z.object({
  leadgen_id: z.string().optional(),
  page_id: z.string().optional(),
  form_id: z.string().optional(),
  created_time: z.string().optional(),
  field_data: z.array(metaFieldSchema).optional(),
  consent: z
    .object({
      text: z.string().min(20),
      source: z.string().min(2),
      timestamp: z.string().optional(),
      canContactEmail: z.boolean().optional(),
      canContactPhone: z.boolean().optional(),
      canContactWhatsapp: z.boolean().optional(),
    })
    .optional(),
});

export function metaFieldsToRecord(fieldData: Array<{ name: string; values: string[] }> = []) {
  return fieldData.reduce<Record<string, string>>((acc, field) => {
    acc[field.name.toLowerCase()] = field.values[0] ?? "";
    return acc;
  }, {});
}
