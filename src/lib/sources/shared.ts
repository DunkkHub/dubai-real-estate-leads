import { scoreOpportunity, suggestedPublicReply } from "@/lib/scoring";
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
  authorHandle?: string | null;
  text: string;
  language?: string;
}): NormalizedOpportunity {
  const publicTextSnippet = safeText(input.text, 500);
  const scoring = scoreOpportunity({ text: publicTextSnippet, platform: input.platform });
  return {
    platform: input.platform,
    sourceUrl: input.sourceUrl,
    authorHandle: safeText(input.authorHandle, 80) || null,
    publicTextSnippet,
    detectedKeywords: scoring.detectedKeywords,
    detectedArea: scoring.detectedArea,
    intentCategory: scoring.intentCategory,
    intentScore: scoring.intentScore,
    sentiment: scoring.sentiment,
    language: input.language ?? "en",
    suggestedAction: suggestedPublicReply(publicTextSnippet),
    summary: `${scoring.intentCategory} opportunity from ${input.platform}`,
  };
}
