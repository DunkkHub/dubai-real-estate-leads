export type NormalizedOpportunity = {
  platform: string;
  sourceUrl: string;
  authorHandle?: string | null;
  publicTextSnippet: string;
  detectedKeywords: string[];
  detectedArea?: string | null;
  intentCategory: string;
  intentScore: number;
  sentiment: string;
  language: string;
  suggestedAction: string;
  summary?: string | null;
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
