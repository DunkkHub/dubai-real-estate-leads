import { ConsentStatus, LeadStage, Prisma, Purpose, TransactionType } from "@/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { validateConsentProof } from "@/lib/consent";
import { prisma } from "@/lib/prisma";
import { scoreLead } from "@/lib/scoring";
import { toCsv } from "@/lib/utils";

export type CreateLeadInput = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  budgetAed?: number | null;
  transactionType: TransactionType;
  propertyType: string;
  preferredArea: string;
  purpose: Purpose;
  timeline: string;
  wantsMortgage?: boolean;
  source: string;
  sourceUrl?: string | null;
  assignedToId?: string | null;
  opportunityId?: string | null;
  consentText: string;
  consentChannel: string;
  consentSourceUrl?: string | null;
  consentTimestamp: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  canContactWhatsapp?: boolean;
  canContactEmail?: boolean;
  canContactPhone?: boolean;
  actorId?: string | null;
};

export async function createConsentedLead(input: CreateLeadInput) {
  const proof = validateConsentProof({
    consentText: input.consentText,
    consentChannel: input.consentChannel,
    consentSourceUrl: input.consentSourceUrl ?? input.sourceUrl ?? "",
    consentTimestamp: input.consentTimestamp,
    canContactWhatsapp: input.canContactWhatsapp ?? Boolean(input.whatsapp),
    canContactEmail: input.canContactEmail ?? Boolean(input.email),
    canContactPhone: input.canContactPhone ?? Boolean(input.phone),
  });

  if (!proof.ok) {
    return { ok: false as const, error: proof.errors.join(" ") };
  }

  if (!input.email && !input.phone && !input.whatsapp) {
    return { ok: false as const, error: "At least one contact method is required after opt-in." };
  }

  const duplicate = await prisma.lead.findFirst({
    where: {
      OR: [
        input.email ? { email: input.email } : undefined,
        input.phone ? { phone: input.phone } : undefined,
        input.whatsapp ? { whatsapp: input.whatsapp } : undefined,
      ].filter(Boolean) as Prisma.LeadWhereInput[],
    },
  });

  if (duplicate) {
    return { ok: false as const, error: "A consented lead already exists with this email, phone, or WhatsApp." };
  }

  const scoring = scoreLead(input);
  const lead = await prisma.$transaction(async (tx) => {
    const createdLead = await tx.lead.create({
      data: {
        fullName: input.fullName,
        email: input.email || null,
        phone: input.phone || null,
        whatsapp: input.whatsapp || null,
        budgetAed: input.budgetAed ?? null,
        transactionType: input.transactionType,
        propertyType: input.propertyType,
        preferredArea: input.preferredArea,
        purpose: input.purpose,
        timeline: input.timeline,
        wantsMortgage: input.wantsMortgage ?? false,
        score: scoring.score,
        temperature: scoring.temperature,
        stage: LeadStage.NEW,
        source: input.source,
        sourceUrl: input.sourceUrl || null,
        assignedToId: input.assignedToId ?? null,
        opportunityId: input.opportunityId ?? null,
        consentStatus: ConsentStatus.ACTIVE,
        consentRecords: {
          create: {
            consentText: proof.data.consentText,
            consentChannel: proof.data.consentChannel,
            consentSourceUrl: proof.data.consentSourceUrl || input.sourceUrl || null,
            consentTimestamp: proof.data.consentTimestamp,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
            canContactWhatsapp: proof.data.canContactWhatsapp,
            canContactEmail: proof.data.canContactEmail,
            canContactPhone: proof.data.canContactPhone,
          },
        },
      },
      include: { consentRecords: true },
    });

    if (input.opportunityId) {
      await tx.opportunity.update({
        where: { id: input.opportunityId },
        data: { status: "CONVERTED" },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: "lead.created",
        entityType: "Lead",
        entityId: createdLead.id,
        leadId: createdLead.id,
        metadata: { source: input.source, score: scoring.score, reasons: scoring.reasons },
      },
    });

    return createdLead;
  });

  return { ok: true as const, lead };
}

export async function withdrawLeadConsent(leadId: string, actorId?: string | null) {
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      consentStatus: ConsentStatus.WITHDRAWN,
      consentRecords: {
        updateMany: {
          where: { withdrawnAt: null },
          data: { withdrawnAt: new Date() },
        },
      },
    },
  });

  await auditLog({
    actorId,
    action: "consent.withdrawn",
    entityType: "Lead",
    entityId: lead.id,
    leadId: lead.id,
  });

  return lead;
}

export async function deleteLeadWithAudit(leadId: string, actorId?: string | null) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;

  await auditLog({
    actorId,
    action: "lead.deleted",
    entityType: "Lead",
    entityId: lead.id,
    leadId: lead.id,
    metadata: { email: lead.email, phone: lead.phone, source: lead.source },
  });

  await prisma.lead.delete({ where: { id: leadId } });
  return lead;
}

export async function leadExportRows(leadIds?: string[]) {
  const leads = await prisma.lead.findMany({
    where: leadIds?.length ? { id: { in: leadIds } } : undefined,
    include: { consentRecords: true, assignedTo: true },
    orderBy: { createdAt: "desc" },
  });

  return leads.map((lead) => ({
    id: lead.id,
    fullName: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    budgetAed: lead.budgetAed,
    transactionType: lead.transactionType,
    propertyType: lead.propertyType,
    preferredArea: lead.preferredArea,
    purpose: lead.purpose,
    timeline: lead.timeline,
    wantsMortgage: lead.wantsMortgage,
    score: lead.score,
    temperature: lead.temperature,
    stage: lead.stage,
    source: lead.source,
    consentStatus: lead.consentStatus,
    assignedTo: lead.assignedTo?.email,
    consentTimestamp: lead.consentRecords.at(-1)?.consentTimestamp.toISOString(),
    consentChannel: lead.consentRecords.at(-1)?.consentChannel,
    createdAt: lead.createdAt.toISOString(),
  }));
}

export async function exportLeadsCsv(leadIds?: string[]) {
  return toCsv(await leadExportRows(leadIds));
}
