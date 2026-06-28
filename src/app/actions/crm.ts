"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LeadStage } from "@/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { complianceSchema, followUpSchema, keywordSchema, manualLeadSchema, noteSchema, sourceConfigSchema } from "@/lib/validators/lead";
import { createConsentedLead, deleteLeadWithAudit, withdrawLeadConsent } from "@/lib/leads";
import { analyzeOpportunityWithAi } from "@/lib/ai";
import { TARGET_KEYWORDS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { suggestedPublicReply } from "@/lib/scoring";
import { fetchRedditOpportunities } from "@/lib/sources/reddit";
import { fetchYouTubeOpportunities } from "@/lib/sources/youtube";
import { fetchXOpportunities } from "@/lib/sources/x";
import { metaStatus } from "@/lib/sources/meta";
import { fetchWebOpportunities } from "@/lib/sources/web";
import type { SourceFetchResult } from "@/lib/sources/types";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formBool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export async function createOutreachTaskAction(formData: FormData) {
  const user = await requireUser();
  const opportunityId = formString(formData, "opportunityId");
  const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
  if (!opportunity) return;

  const ai = await analyzeOpportunityWithAi(opportunity.publicTextSnippet);
  const task = await prisma.outreachTask.create({
    data: {
      opportunityId,
      platform: opportunity.platform,
      suggestedPublicReply: ai.suggestedPublicReply || suggestedPublicReply(opportunity.publicTextSnippet),
      status: "PENDING",
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      assignedToId: user.id,
    },
  });

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      status: "OUTREACH_CREATED",
      summary: ai.summary,
      intentCategory: ai.intentCategory,
    },
  });

  await auditLog({
    actorId: user.id,
    action: "outreach.created",
    entityType: "OutreachTask",
    entityId: task.id,
    metadata: { opportunityId },
  });

  revalidatePath("/opportunities");
  revalidatePath("/outreach");
  revalidatePath("/dashboard");
}

export async function markOpportunityNotRelevantAction(formData: FormData) {
  const user = await requireUser();
  const opportunityId = formString(formData, "opportunityId");
  await prisma.opportunity.update({ where: { id: opportunityId }, data: { status: "NOT_RELEVANT" } });
  await auditLog({ actorId: user.id, action: "opportunity.not_relevant", entityType: "Opportunity", entityId: opportunityId });
  revalidatePath("/opportunities");
  revalidatePath("/dashboard");
}

export async function convertOpportunityToLeadAction(formData: FormData) {
  const user = await requireUser();
  const parsed = manualLeadSchema.safeParse({
    fullName: formString(formData, "fullName"),
    email: formString(formData, "email"),
    phone: formString(formData, "phone"),
    whatsapp: formString(formData, "whatsapp"),
    budgetAed: formString(formData, "budgetAed"),
    transactionType: formString(formData, "transactionType"),
    propertyType: formString(formData, "propertyType"),
    preferredArea: formString(formData, "preferredArea"),
    purpose: formString(formData, "purpose"),
    timeline: formString(formData, "timeline"),
    wantsMortgage: formBool(formData, "wantsMortgage"),
    consentText: formString(formData, "consentText"),
    canContactWhatsapp: formBool(formData, "canContactWhatsapp"),
    canContactEmail: formBool(formData, "canContactEmail"),
    canContactPhone: formBool(formData, "canContactPhone"),
    source: "manual opportunity conversion",
    sourceUrl: formString(formData, "sourceUrl"),
    opportunityId: formString(formData, "opportunityId"),
    consentChannel: formString(formData, "consentChannel"),
    consentSourceUrl: formString(formData, "consentSourceUrl"),
    consentTimestamp: formString(formData, "consentTimestamp"),
  });

  if (!parsed.success) {
    redirect(`/opportunities?error=${encodeURIComponent(parsed.error.issues[0]?.message || "Invalid lead data")}`);
  }

  const result = await createConsentedLead({
    ...parsed.data,
    assignedToId: user.id,
    actorId: user.id,
  });

  if (!result.ok) {
    redirect(`/opportunities?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/opportunities");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  redirect(`/leads/${result.lead.id}`);
}

export async function updateOutreachStatusAction(formData: FormData) {
  const user = await requireUser();
  const id = formString(formData, "id");
  const status = formString(formData, "status") as "PENDING" | "REPLIED" | "IGNORED" | "CONVERTED";
  await prisma.outreachTask.update({ where: { id }, data: { status } });
  await auditLog({ actorId: user.id, action: "outreach.status_updated", entityType: "OutreachTask", entityId: id, metadata: { status } });
  revalidatePath("/outreach");
}

export async function updateLeadStageAction(formData: FormData) {
  const user = await requireUser();
  const id = formString(formData, "leadId");
  const stage = formString(formData, "stage") as LeadStage;
  await prisma.lead.update({ where: { id }, data: { stage } });
  await auditLog({ actorId: user.id, action: "lead.stage_updated", entityType: "Lead", entityId: id, leadId: id, metadata: { stage } });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/dashboard");
}

export async function addNoteAction(formData: FormData) {
  const user = await requireUser();
  const parsed = noteSchema.safeParse({
    leadId: formString(formData, "leadId"),
    body: formString(formData, "body"),
  });
  if (!parsed.success) return;

  await prisma.note.create({
    data: {
      leadId: parsed.data.leadId,
      body: parsed.data.body,
      authorId: user.id,
    },
  });
  await auditLog({ actorId: user.id, action: "note.created", entityType: "Lead", entityId: parsed.data.leadId, leadId: parsed.data.leadId });
  revalidatePath(`/leads/${parsed.data.leadId}`);
}

export async function addFollowUpAction(formData: FormData) {
  const user = await requireUser();
  const parsed = followUpSchema.safeParse({
    leadId: formString(formData, "leadId"),
    title: formString(formData, "title"),
    dueDate: formString(formData, "dueDate"),
  });
  if (!parsed.success) return;

  await prisma.followUpTask.create({
    data: {
      leadId: parsed.data.leadId,
      title: parsed.data.title,
      dueDate: parsed.data.dueDate,
      assignedToId: user.id,
    },
  });
  await auditLog({ actorId: user.id, action: "follow_up.created", entityType: "Lead", entityId: parsed.data.leadId, leadId: parsed.data.leadId });
  revalidatePath(`/leads/${parsed.data.leadId}`);
}

export async function completeFollowUpAction(formData: FormData) {
  const user = await requireUser();
  const id = formString(formData, "id");
  const leadId = formString(formData, "leadId");
  await prisma.followUpTask.update({ where: { id }, data: { completedAt: new Date() } });
  await auditLog({ actorId: user.id, action: "follow_up.completed", entityType: "FollowUpTask", entityId: id, leadId });
  revalidatePath(`/leads/${leadId}`);
}

export async function withdrawConsentAction(formData: FormData) {
  const user = await requireUser();
  const leadId = formString(formData, "leadId");
  await withdrawLeadConsent(leadId, user.id);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function deleteLeadAction(formData: FormData) {
  const user = await requireUser();
  const leadId = formString(formData, "leadId");
  await deleteLeadWithAudit(leadId, user.id);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  redirect("/leads");
}

export async function updateComplianceAction(formData: FormData) {
  const user = await requireUser();
  const parsed = complianceSchema.safeParse({
    consentText: formString(formData, "consentText"),
    privacyPolicyText: formString(formData, "privacyPolicyText"),
    unsubscribeText: formString(formData, "unsubscribeText"),
    allowedContactStartHour: formString(formData, "allowedContactStartHour"),
    allowedContactEndHour: formString(formData, "allowedContactEndHour"),
    dataRetentionDays: formString(formData, "dataRetentionDays"),
  });
  if (!parsed.success) return;

  const existing = await prisma.complianceSetting.findFirst();
  const setting = existing
    ? await prisma.complianceSetting.update({ where: { id: existing.id }, data: parsed.data })
    : await prisma.complianceSetting.create({ data: parsed.data });

  await auditLog({ actorId: user.id, action: "compliance.updated", entityType: "ComplianceSetting", entityId: setting.id });
  revalidatePath("/settings/compliance");
  revalidatePath("/privacy");
  revalidatePath("/landing");
}

export async function addKeywordAction(formData: FormData) {
  const user = await requireUser();
  const parsed = keywordSchema.safeParse({
    type: formString(formData, "type"),
    value: formString(formData, "value"),
  });
  if (!parsed.success) return;

  await prisma.keywordConfig.upsert({
    where: { type_value: { type: parsed.data.type, value: parsed.data.value } },
    update: { enabled: true },
    create: parsed.data,
  });
  await auditLog({ actorId: user.id, action: "keyword.upserted", entityType: "KeywordConfig", metadata: parsed.data });
  revalidatePath("/sources");
}

export async function deleteKeywordAction(formData: FormData) {
  const user = await requireUser();
  const id = formString(formData, "id");
  await prisma.keywordConfig.delete({ where: { id } });
  await auditLog({ actorId: user.id, action: "keyword.deleted", entityType: "KeywordConfig", entityId: id });
  revalidatePath("/sources");
}

export async function updateSourceEnabledAction(formData: FormData) {
  const user = await requireUser();
  const parsed = sourceConfigSchema.safeParse({
    platform: formString(formData, "platform"),
    enabled: formBool(formData, "enabled"),
  });
  if (!parsed.success) return;

  await prisma.sourceConfig.upsert({
    where: { platform: parsed.data.platform },
    update: { enabled: parsed.data.enabled },
    create: {
      platform: parsed.data.platform,
      enabled: parsed.data.enabled,
      status: "not_configured",
      config: {},
    },
  });
  await auditLog({ actorId: user.id, action: "source.updated", entityType: "SourceConfig", metadata: parsed.data });
  revalidatePath("/sources");
}

export async function addScraperUrlAction(formData: FormData) {
  const user = await requireUser();
  const rawUrl = formString(formData, "url");
  let url: string;

  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return;
    parsed.hash = "";
    url = parsed.toString();
  } catch {
    return;
  }

  const existing = await prisma.sourceConfig.findUnique({ where: { platform: "Public Web" } });
  const urls = sourceConfigUrls(existing?.config);
  const nextUrls = Array.from(new Set([...urls, url]));

  await prisma.sourceConfig.upsert({
    where: { platform: "Public Web" },
    update: {
      enabled: true,
      status: "configured",
      config: { urls: nextUrls },
    },
    create: {
      platform: "Public Web",
      enabled: true,
      status: "configured",
      config: { urls: nextUrls },
    },
  });

  await auditLog({ actorId: user.id, action: "scraper.url_added", entityType: "SourceConfig", metadata: { url } });
  revalidatePath("/sources");
}

export async function deleteScraperUrlAction(formData: FormData) {
  const user = await requireUser();
  const rawUrl = formString(formData, "url");
  const existing = await prisma.sourceConfig.findUnique({ where: { platform: "Public Web" } });
  const nextUrls = sourceConfigUrls(existing?.config).filter((url) => url !== rawUrl);

  await prisma.sourceConfig.upsert({
    where: { platform: "Public Web" },
    update: {
      status: nextUrls.length ? "configured" : "not_configured",
      config: { urls: nextUrls },
    },
    create: {
      platform: "Public Web",
      enabled: false,
      status: "not_configured",
      config: { urls: nextUrls },
    },
  });

  await auditLog({ actorId: user.id, action: "scraper.url_deleted", entityType: "SourceConfig", metadata: { url: rawUrl } });
  revalidatePath("/sources");
}

export async function syncSourceAction(formData: FormData) {
  const user = await requireUser();
  const platform = formString(formData, "platform");
  const dryRun = formBool(formData, "dryRun");
  const keywords = await prisma.keywordConfig.findMany({
    where: { type: "TARGET", enabled: true },
    orderBy: { value: "asc" },
  });
  const keywordValues = keywords.length ? keywords.map((keyword) => keyword.value) : TARGET_KEYWORDS;
  const platforms = platform === "All" ? ["Reddit", "YouTube", "X", "Meta", "Public Web"] : [platform];
  const results: Array<{ platform: string; result: SourceFetchResult; saved: number }> = [];

  for (const current of platforms) {
    const result = await fetchSource(current, keywordValues, dryRun);
    let saved = 0;

    if (!dryRun && result.opportunities.length > 0) {
      for (const opportunity of result.opportunities) {
        await prisma.opportunity.upsert({
          where: { sourceUrl: opportunity.sourceUrl },
          update: {
            platform: opportunity.platform,
            authorHandle: opportunity.authorHandle,
            publicTextSnippet: opportunity.publicTextSnippet,
            detectedKeywords: opportunity.detectedKeywords,
            detectedArea: opportunity.detectedArea,
            intentCategory: opportunity.intentCategory,
            intentScore: opportunity.intentScore,
            sentiment: opportunity.sentiment,
            language: opportunity.language,
            suggestedAction: opportunity.suggestedAction,
            summary: opportunity.summary,
          },
          create: opportunity,
        });
        saved += 1;
      }
    }

    await prisma.sourceConfig.upsert({
      where: { platform: current },
      update: {
        status: result.status,
        lastCheckedAt: new Date(),
      },
      create: {
        platform: current,
        enabled: result.configured,
        status: result.status,
        config: {},
        lastCheckedAt: new Date(),
      },
    });

    results.push({ platform: current, result, saved });
  }

  await auditLog({
    actorId: user.id,
    action: dryRun ? "source.dry_run" : "source.synced",
    entityType: "SourceConfig",
    metadata: {
      platform,
      dryRun,
      results: results.map((item) => ({
        platform: item.platform,
        status: item.result.status,
        found: item.result.opportunities.length,
        saved: item.saved,
      })),
    },
  });

  revalidatePath("/sources");
  revalidatePath("/opportunities");
  revalidatePath("/dashboard");

  const found = results.reduce((total, item) => total + item.result.opportunities.length, 0);
  const saved = results.reduce((total, item) => total + item.saved, 0);
  const notConfigured = results.filter((item) => item.result.status === "not_configured").map((item) => item.platform);
  const message = dryRun
    ? `Dry run found ${found} public opportunities. ${notConfigured.length ? `Not configured: ${notConfigured.join(", ")}.` : ""}`
    : `Saved ${saved} public opportunities. ${notConfigured.length ? `Not configured: ${notConfigured.join(", ")}.` : ""}`;

  redirect(`/sources?sync=${encodeURIComponent(message)}`);
}

async function fetchSource(platform: string, keywords: string[], dryRun: boolean) {
  switch (platform) {
    case "Reddit":
      return fetchRedditOpportunities({ keywords, dryRun, limit: 25 });
    case "YouTube":
      return fetchYouTubeOpportunities({ keywords, dryRun, limit: 15 });
    case "X":
      return fetchXOpportunities({ keywords, dryRun, limit: 25 });
    case "Meta":
      return metaStatus();
    case "Public Web": {
      const config = await prisma.sourceConfig.findUnique({ where: { platform: "Public Web" } });
      return fetchWebOpportunities({ keywords, dryRun, limit: 20, urls: sourceConfigUrls(config?.config) });
    }
    default:
      return {
        configured: false,
        status: "not_configured" as const,
        message: `${platform} is available through CSV import or a business-owned integration only.`,
        opportunities: [],
      };
  }
}

function sourceConfigUrls(config: unknown) {
  if (!config || typeof config !== "object" || !("urls" in config)) return [];
  const urls = (config as { urls?: unknown }).urls;
  if (!Array.isArray(urls)) return [];
  return urls.filter((url): url is string => typeof url === "string");
}
