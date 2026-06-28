import { normalizePublicTextOpportunity, notConfigured, sourceRateLimit, dryRun } from "@/lib/sources/shared";
import type { SourceFetchOptions, SourceFetchResult } from "@/lib/sources/types";

type RedditListingChild = {
  data?: {
    title?: string;
    selftext?: string;
    permalink?: string;
    author?: string;
  };
};

async function redditToken() {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT;
  if (!clientId || !clientSecret || !userAgent) return null;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) throw new Error(`Reddit token request failed: ${response.status}`);
  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export async function fetchRedditOpportunities(options: SourceFetchOptions): Promise<SourceFetchResult> {
  const missing = ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USER_AGENT"].filter((key) => !process.env[key]);
  if (missing.length) return notConfigured("Reddit", missing);

  const sample = options.keywords.slice(0, 3).map((keyword, index) =>
    normalizePublicTextOpportunity({
      platform: "Reddit",
      sourceUrl: `https://www.reddit.com/r/dubai/search?q=${encodeURIComponent(keyword)}&sample=${index}`,
      authorHandle: "public_reddit_user",
      text: `Looking for advice about ${keyword}, budget and areas in Dubai.`,
    }),
  );
  if (options.dryRun) return dryRun("Reddit", sample);

  if (!sourceRateLimit("reddit")) {
    return { configured: true, status: "error", message: "Reddit rate limit active. Try again shortly.", opportunities: [] };
  }

  try {
    const token = await redditToken();
    if (!token) return notConfigured("Reddit", missing);

    const query = options.keywords.slice(0, 8).join(" OR ");
    const url = new URL("https://oauth.reddit.com/search");
    url.searchParams.set("q", query);
    url.searchParams.set("sort", "new");
    url.searchParams.set("limit", String(options.limit ?? 20));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": process.env.REDDIT_USER_AGENT || "DubaiLeadCRM/1.0",
      },
    });

    if (!response.ok) throw new Error(`Reddit search failed: ${response.status}`);
    const data = (await response.json()) as { data?: { children?: RedditListingChild[] } };
    const opportunities = (data.data?.children ?? [])
      .map((child) => child.data)
      .filter(Boolean)
      .map((post) =>
        normalizePublicTextOpportunity({
          platform: "Reddit",
          sourceUrl: post?.permalink ? `https://www.reddit.com${post.permalink}` : "https://www.reddit.com",
          authorHandle: post?.author,
          text: `${post?.title ?? ""} ${post?.selftext ?? ""}`,
        }),
      );

    return { configured: true, status: "configured", message: "Reddit public search completed.", opportunities };
  } catch (error) {
    return {
      configured: true,
      status: "error",
      message: error instanceof Error ? error.message : "Reddit fetch failed.",
      opportunities: [],
    };
  }
}
