import { dryRun, normalizePublicTextOpportunity, notConfigured, sourceRateLimit } from "@/lib/sources/shared";
import type { SourceFetchOptions, SourceFetchResult } from "@/lib/sources/types";

type XTweets = {
  data?: Array<{
    id: string;
    text: string;
    author_id?: string;
  }>;
};

export async function fetchXOpportunities(options: SourceFetchOptions): Promise<SourceFetchResult> {
  if (!process.env.X_BEARER_TOKEN) return notConfigured("X", ["X_BEARER_TOKEN"]);

  const sample = options.keywords.slice(0, 3).map((keyword, index) =>
    normalizePublicTextOpportunity({
      platform: "X",
      sourceUrl: `https://x.com/search?q=${encodeURIComponent(keyword)}&sample=${index}`,
      authorHandle: "public_x_user",
      text: `Can anyone recommend where to ${keyword}? Comparing JVC and Dubai Marina.`,
    }),
  );
  if (options.dryRun) return dryRun("X", sample);

  if (!sourceRateLimit("x")) {
    return { configured: true, status: "error", message: "X rate limit active. Try again shortly.", opportunities: [] };
  }

  try {
    const query = `${options.keywords.slice(0, 6).map((keyword) => `"${keyword}"`).join(" OR ")} lang:en -is:retweet`;
    const url = new URL("https://api.x.com/2/tweets/search/recent");
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", String(Math.min(Math.max(options.limit ?? 10, 10), 100)));
    url.searchParams.set("tweet.fields", "author_id,created_at,lang");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.X_BEARER_TOKEN}`,
      },
    });
    if (!response.ok) throw new Error(`X recent search failed: ${response.status}`);
    const data = (await response.json()) as XTweets;

    const opportunities = (data.data ?? []).map((tweet) =>
      normalizePublicTextOpportunity({
        platform: "X",
        sourceUrl: `https://x.com/i/web/status/${tweet.id}`,
        authorHandle: tweet.author_id ? `author:${tweet.author_id}` : null,
        text: tweet.text,
      }),
    );

    return { configured: true, status: "configured", message: "X public recent search completed.", opportunities };
  } catch (error) {
    return {
      configured: true,
      status: "error",
      message: error instanceof Error ? error.message : "X fetch failed.",
      opportunities: [],
    };
  }
}
