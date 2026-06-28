import { DEFAULT_CONSENT_TEXT, DEFAULT_PRIVACY_POLICY, DEFAULT_UNSUBSCRIBE_TEXT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function getComplianceSettings() {
  const existing = await prisma.complianceSetting.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;

  return prisma.complianceSetting.create({
    data: {
      consentText: DEFAULT_CONSENT_TEXT,
      privacyPolicyText: DEFAULT_PRIVACY_POLICY,
      unsubscribeText: DEFAULT_UNSUBSCRIBE_TEXT,
      allowedContactStartHour: 9,
      allowedContactEndHour: 18,
      dataRetentionDays: 730,
    },
  });
}
