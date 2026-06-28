export type NormalizedOpportunity = {
  platform: string;
  sourceUrl: string;
  title?: string | null;
  externalId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  authorHandle?: string | null;
  publicTextSnippet: string;
  detectedKeywords: string[];
  detectedArea?: string | null;
  detectedBudget?: string | null;
  detectedTimeline?: string | null;
  detectedPropertyType?: string | null;
  intentCategory: string;
  intentScore: number;
  sentiment: string;
  language: string;
  suggestedAction: string;
  summary?: string | null;
  scrapedAt?: Date | string | null;
  dedupeHash?: string | null;
  rawJson?: Record<string, unknown>;
};

export type SourceFetchOptions = {
  keywords: string[];
  dryRun?: boolean;
  limit?: number;
};

export type SourceFetchResult = {
  configured: boolean;
  status: "configured" | "not_configured" | "dry_run" | "error";
  message: string;
  opportunities: NormalizedOpportunity[];
};
