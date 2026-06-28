"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LeadStage } from "@/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { complianceSchema, followUpSchema, keywordSchema, manualLeadSchema, noteSchema, sourceConfigSchema } from "@/lib/validators/lead";
import { createConsentedLead, deleteLeadWithAudit, withdrawLeadConsent } from "@/lib/leads";
import { analyzeOpportunityWithAi } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { suggestedPublicReply } from "@/lib/scoring";

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
