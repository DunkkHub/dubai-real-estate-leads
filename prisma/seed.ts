import { hash } from "bcryptjs";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ConsentStatus,
  ImportStatus,
  ImportType,
  KeywordType,
  LeadStage,
  OpportunityStatus,
  OutreachStatus,
  PrismaClient,
  Purpose,
  TransactionType,
  UserRole,
} from "../src/generated/prisma/client";
import {
  DEFAULT_CONSENT_TEXT,
  DEFAULT_PRIVACY_POLICY,
  DEFAULT_UNSUBSCRIBE_TEXT,
  DUBAI_AREAS,
  EXCLUDED_KEYWORDS,
  TARGET_KEYWORDS,
} from "../src/lib/constants";
import { scoreLead, scoreOpportunity, suggestedPublicReply } from "../src/lib/scoring";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

const opportunityTexts = [
  ["Reddit", "moving to Dubai with family, best area to live in Dubai near schools and metro?"],
  ["X", "Thinking to buy apartment Dubai Marina vs JVC apartment for long term rental yield."],
  ["YouTube", "Comments asking if Dubai property investment still has good ROI in Business Bay."],
  ["Reddit", "Need mortgage Dubai advice for first apartment purchase around 1.8m AED."],
  ["X", "Off-plan Dubai projects: what should I check before paying booking fee?"],
  ["YouTube", "Viewer asks whether Palm Jumeirah villa prices are too high for investment."],
  ["Reddit", "Relocate Dubai next quarter, rent first or buy if budget is 2m?"],
  ["X", "Best area to live in Dubai for DIFC commute and marina lifestyle?"],
  ["YouTube", "Comment thread comparing service charges in Downtown and Dubai Hills."],
  ["Reddit", "Dubai Marina rent is rising, should I buy a one bed instead?"],
  ["X", "Looking for JVC apartment under 900k, any building red flags?"],
  ["YouTube", "Investor asks about net yield after service charges in Business Bay."],
  ["Reddit", "Moving to Dubai South for work, buy townhouse or rent first?"],
  ["X", "Mortgage pre approval Dubai, what salary documents are needed?"],
  ["YouTube", "Question about off-plan handover delays and escrow protection in Dubai."],
  ["Reddit", "Best area to live in Dubai with dog parks, budget 170k rent."],
  ["X", "Dubai property ROI calculator recommendations for Airbnb holiday home numbers."],
  ["YouTube", "Comment asks if Dubai Hills apartment is better than Downtown for family living."],
  ["Reddit", "Buy villa Dubai or apartment for investment, budget 3.5m AED."],
  ["X", "Relocating from London to Dubai, comparing JLT and Dubai Marina rent."],
  ["YouTube", "Viewer asks about mortgage Dubai for non resident buyers."],
  ["Reddit", "Off-plan Dubai payment plan looks attractive, what hidden costs exist?"],
  ["X", "Business Bay apartment expected rent and service charges question."],
  ["YouTube", "Comment about Palm Jumeirah holiday home ROI and occupancy."],
  ["Reddit", "Not interested in agents spamming me, just want area comparison data."],
  ["X", "School project about Dubai buildings, need general facts."],
  ["YouTube", "Agent complaint thread saying fake listing scam in Dubai Marina."],
  ["Reddit", "Moving to Dubai in 0-3 months, budget 1.2m, need apartment near metro."],
  ["X", "Should I invest in Dubai Creek Harbour or Downtown for capital appreciation?"],
  ["YouTube", "Question: is JVC apartment good for first-time investor with mortgage?"],
] as const;

const leadSeeds = [
  ["Aisha Khan", "aisha@example.com", "+971501111111", "+971501111111", 2_600_000, "BUY", "Apartment", "Downtown", "INVESTMENT", "0-3 months", true, "landing"],
  ["Omar Haddad", "omar@example.com", "+971502222222", "+971502222222", 1_250_000, "BUY", "Apartment", "JVC", "LIVING", "3-6 months", false, "calculator"],
  ["Maya Singh", "maya@example.com", "+971503333333", "+971503333333", 3_400_000, "BUY", "Villa", "Dubai Hills", "RELOCATION", "0-3 months", true, "Meta Lead Ads"],
  ["James Wilson", "james@example.com", "+971504444444", "+971504444444", 950_000, "BUY", "Studio", "Business Bay", "INVESTMENT", "6-12 months", false, "landing"],
  ["Fatima Noor", "fatima@example.com", "+971505555555", "+971505555555", 2_100_000, "BUY", "Apartment", "Dubai Marina", "HOLIDAY_HOME", "3-6 months", true, "calculator"],
  ["Daniel Rossi", "daniel@example.com", "+971506666666", "+971506666666", 700_000, "RENT", "Apartment", "JLT", "LIVING", "12+ months", false, "landing"],
  ["Sara Ahmed", "sara@example.com", "+971507777777", "+971507777777", 4_500_000, "BUY", "Townhouse", "Palm Jumeirah", "INVESTMENT", "0-3 months", true, "manual opportunity conversion"],
  ["Noah Chen", "noah@example.com", "+971508888888", "+971508888888", 1_650_000, "BUY", "Apartment", "Business Bay", "INVESTMENT", "3-6 months", false, "Meta Lead Ads"],
  ["Layla Mansour", "layla@example.com", "+971509999999", "+971509999999", 1_100_000, "BUY", "Apartment", "Dubai Creek Harbour", "RELOCATION", "6-12 months", true, "landing"],
  ["Priya Patel", "priya@example.com", "+971501010101", "+971501010101", 2_900_000, "BUY", "Penthouse", "Dubai Marina", "INVESTMENT", "0-3 months", true, "calculator"],
] as const;

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.followUpTask.deleteMany();
  await prisma.note.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.outreachTask.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.keywordConfig.deleteMany();
  await prisma.sourceConfig.deleteMany();
  await prisma.complianceSetting.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      name: "Seeded Admin",
      email: "admin@dubai-leads.local",
      passwordHash: await hash("Password123!", 12),
      role: UserRole.ADMIN,
    },
  });

  await prisma.complianceSetting.create({
    data: {
      consentText: DEFAULT_CONSENT_TEXT,
      privacyPolicyText: DEFAULT_PRIVACY_POLICY,
      unsubscribeText: DEFAULT_UNSUBSCRIBE_TEXT,
      allowedContactStartHour: 9,
      allowedContactEndHour: 18,
      dataRetentionDays: 730,
    },
  });

  await prisma.sourceConfig.createMany({
    data: ["Reddit", "YouTube", "X", "Meta", "LinkedIn"].map((platform) => ({
      platform,
      enabled: platform !== "LinkedIn",
      status: platform === "LinkedIn" ? "manual_import" : "not_configured",
      config: {},
    })),
  });

  await prisma.keywordConfig.createMany({
    data: [
      ...TARGET_KEYWORDS.map((value) => ({ type: KeywordType.TARGET, value })),
      ...EXCLUDED_KEYWORDS.map((value) => ({ type: KeywordType.EXCLUDED, value })),
      ...DUBAI_AREAS.map((value) => ({ type: KeywordType.AREA, value })),
    ],
    skipDuplicates: true,
  });

  const opportunities = [];
  for (const [index, [platform, text]] of opportunityTexts.entries()) {
    const scored = scoreOpportunity({ text, platform });
    opportunities.push(
      await prisma.opportunity.create({
        data: {
          platform,
          sourceUrl: `https://example.com/${platform.toLowerCase()}/dubai-intent-${index + 1}`,
          authorHandle: `${platform.toLowerCase()}_public_${index + 1}`,
          publicTextSnippet: text,
          detectedKeywords: scored.detectedKeywords,
          detectedArea: scored.detectedArea,
          intentCategory: scored.intentCategory,
          intentScore: scored.intentScore,
          sentiment: scored.sentiment,
          language: "en",
          suggestedAction: suggestedPublicReply(text),
          summary: `${scored.intentCategory} public conversation`,
          status: scored.shouldIgnore ? OpportunityStatus.NOT_RELEVANT : OpportunityStatus.NEW,
          createdAt: new Date(Date.now() - index * 3 * 60 * 60 * 1000),
        },
      }),
    );
  }

  for (const [index, seed] of leadSeeds.entries()) {
    const [fullName, email, phone, whatsapp, budgetAed, transactionType, propertyType, preferredArea, purpose, timeline, wantsMortgage, source] = seed;
    const scoring = scoreLead({ budgetAed, timeline, purpose, preferredArea, email, phone, whatsapp, wantsMortgage });
    const lead = await prisma.lead.create({
      data: {
        fullName,
        email,
        phone,
        whatsapp,
        budgetAed,
        transactionType: transactionType as TransactionType,
        propertyType,
        preferredArea,
        purpose: purpose as Purpose,
        timeline,
        wantsMortgage,
        score: scoring.score,
        temperature: scoring.temperature,
        stage: Object.values(LeadStage)[index % Object.values(LeadStage).length],
        source,
        sourceUrl: source === "calculator" ? "http://localhost:3000/calculator" : "http://localhost:3000/landing",
        assignedToId: admin.id,
        consentStatus: ConsentStatus.ACTIVE,
        createdAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000),
        consentRecords: {
          create: {
            consentText: DEFAULT_CONSENT_TEXT,
            consentChannel: source,
            consentSourceUrl: source === "Meta Lead Ads" ? "https://business.facebook.com/lead-form/sample" : "http://localhost:3000/landing",
            consentTimestamp: new Date(Date.now() - index * 24 * 60 * 60 * 1000),
            ipAddress: `192.0.2.${index + 10}`,
            userAgent: "Seed script",
            canContactEmail: true,
            canContactPhone: true,
            canContactWhatsapp: true,
          },
        },
        notes: {
          create: {
            authorId: admin.id,
            body: `Initial qualification note for ${preferredArea}. Score reasons: ${scoring.reasons.join(", ")}.`,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "lead.created",
        entityType: "Lead",
        entityId: lead.id,
        leadId: lead.id,
        metadata: { source, score: scoring.score },
      },
    });
  }

  for (const [index, opportunity] of opportunities.slice(0, 10).entries()) {
    await prisma.outreachTask.create({
      data: {
        opportunityId: opportunity.id,
        platform: opportunity.platform,
        suggestedPublicReply: opportunity.suggestedAction,
        status: index % 3 === 0 ? OutreachStatus.REPLIED : OutreachStatus.PENDING,
        dueDate: new Date(Date.now() + (index + 1) * 12 * 60 * 60 * 1000),
        assignedToId: admin.id,
      },
    });
  }

  const leads = await prisma.lead.findMany({ take: 5, orderBy: { createdAt: "desc" } });
  for (const [index, lead] of leads.entries()) {
    await prisma.followUpTask.create({
      data: {
        leadId: lead.id,
        title: `Follow up on ${lead.preferredArea} shortlist`,
        dueDate: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000),
        assignedToId: admin.id,
      },
    });
  }

  await prisma.importJob.create({
    data: {
      type: ImportType.OPPORTUNITIES,
      status: ImportStatus.COMPLETED,
      filename: "sample-opportunities.csv",
      totalRows: 30,
      importedRows: 30,
      rejectedRows: 0,
    },
  });

  console.log("Seed complete: admin@dubai-leads.local / Password123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
