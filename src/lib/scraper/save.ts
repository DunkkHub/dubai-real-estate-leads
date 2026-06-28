import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { NormalizedOpportunity } from "@/lib/sources/types";

export async function createScrapeJob(source: string, query: string) {
  return prisma.scrapeJob.create({
    data: {
      source,
      query,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });
}

export async function finishScrapeJob(input: {
  id: string;
  status: "SUCCESS" | "FAILED";
  resultsCount: number;
  savedCount: number;
  error?: string | null;
}) {
  return prisma.scrapeJob.update({
    where: { id: input.id },
    data: {
      status: input.status,
      resultsCount: input.resultsCount,
      savedCount: input.savedCount,
      error: input.error ?? null,
      finishedAt: new Date(),
    },
  });
}

export async function saveOpportunities(opportunities: NormalizedOpportunity[]) {
  let savedCount = 0;

  for (const opportunity of opportunities) {
    if (opportunity.intentScore < 20) continue;
    const data = opportunityToPrismaData(opportunity);
    const where = opportunity.dedupeHash
      ? { dedupeHash: opportunity.dedupeHash }
      : { platform_sourceUrl: { platform: opportunity.platform, sourceUrl: opportunity.sourceUrl } };

    await prisma.opportunity.upsert({
      where,
      update: data,
      create: data,
    });
    savedCount += 1;
  }

  return savedCount;
}

function opportunityToPrismaData(opportunity: NormalizedOpportunity): Prisma.OpportunityCreateInput {
  return {
    platform: opportunity.platform,
    sourceUrl: opportunity.sourceUrl,
    title: opportunity.title ?? null,
    externalId: opportunity.externalId ?? null,
    postId: opportunity.postId ?? null,
    commentId: opportunity.commentId ?? null,
    authorHandle: opportunity.authorHandle ?? null,
    publicTextSnippet: opportunity.publicTextSnippet,
    detectedKeywords: opportunity.detectedKeywords,
    detectedArea: opportunity.detectedArea ?? null,
    detectedBudget: opportunity.detectedBudget ?? null,
    detectedTimeline: opportunity.detectedTimeline ?? null,
    detectedPropertyType: opportunity.detectedPropertyType ?? null,
    intentCategory: opportunity.intentCategory,
    intentScore: opportunity.intentScore,
    sentiment: opportunity.sentiment,
    language: opportunity.language,
    suggestedAction: opportunity.suggestedAction,
    summary: opportunity.summary ?? null,
    status: opportunity.intentScore < 20 ? "NOT_RELEVANT" : "NEW",
    scrapedAt: opportunity.scrapedAt ? new Date(opportunity.scrapedAt) : new Date(),
    dedupeHash: opportunity.dedupeHash ?? null,
    rawJson: toJson(opportunity.rawJson ?? {}),
  };
}

function toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
