import { scoreOpportunity, suggestedPublicReply } from "@/lib/scoring";
import { opportunityDedupeHash } from "@/lib/scraper/dedupe";
import { safeText } from "@/lib/utils";
import type { NormalizedOpportunity, SourceFetchResult } from "@/lib/sources/types";

const sourceBuckets = new Map<string, number>();

export function sourceRateLimit(key: string, minIntervalMs = 1500) {
  const now = Date.now();
  const last = sourceBuckets.get(key) ?? 0;
  if (now - last < minIntervalMs) {
    return false;
  }
  sourceBuckets.set(key, now);
  return true;
}

export function notConfigured(platform: string, missing: string[]): SourceFetchResult {
  return {
    configured: false,
    status: "not_configured",
    message: `${platform} is not configured. Missing ${missing.join(", ")}.`,
    opportunities: [],
  };
}

export function dryRun(platform: string, opportunities: NormalizedOpportunity[]): SourceFetchResult {
  return {
    configured: true,
    status: "dry_run",
    message: `${platform} dry run completed without storing or contacting anyone.`,
    opportunities,
  };
}

export function normalizePublicTextOpportunity(input: {
  platform: string;
  sourceUrl: string;
  title?: string | null;
  externalId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  authorHandle?: string | null;
  text: string;
  scrapedAt?: Date | string | null;
  language?: string;
  rawJson?: Record<string, unknown>;
}): NormalizedOpportunity {
  const publicTextSnippet = safeText(redactContactData(input.text), 700);
  const scoring = scoreOpportunity({ text: publicTextSnippet, platform: input.platform });
  const title = input.title ? safeText(redactContactData(input.title), 180) : null;
  const dedupeHash = opportunityDedupeHash({
    platform: input.platform,
    externalId: input.externalId,
    postId: input.postId,
    commentId: input.commentId,
    sourceUrl: input.sourceUrl,
    text: publicTextSnippet,
  });
  return {
    platform: input.platform,
    sourceUrl: input.sourceUrl,
    title,
    externalId: input.externalId ?? null,
    postId: input.postId ?? null,
    commentId: input.commentId ?? null,
    authorHandle: safeText(input.authorHandle, 80) || null,
    publicTextSnippet,
    detectedKeywords: scoring.detectedKeywords,
    detectedArea: scoring.detectedArea,
    detectedBudget: scoring.detectedBudget,
    detectedTimeline: scoring.detectedTimeline,
    detectedPropertyType: scoring.detectedPropertyType,
    intentCategory: scoring.intentCategory,
    intentScore: scoring.intentScore,
    sentiment: scoring.sentiment,
    language: input.language ?? "en",
    suggestedAction: suggestedPublicReply(publicTextSnippet),
    summary: `${scoring.intentCategory} opportunity from ${input.platform}`,
    scrapedAt: input.scrapedAt ?? new Date(),
    dedupeHash,
    rawJson: input.rawJson ?? {},
  };
}

export function redactContactData(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[redacted phone]")
    .replace(/\b(?:whatsapp|wa)\s*[:\-]?\s*[+\d][\d\s().-]{7,}\b/gi, "[redacted WhatsApp]")
    .replace(/\s+/g, " ")
    .trim();
}
