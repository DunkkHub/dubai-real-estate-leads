import { dryRun, normalizePublicTextOpportunity, notConfigured, sourceRateLimit } from "@/lib/sources/shared";
import type { SourceFetchOptions, SourceFetchResult } from "@/lib/sources/types";

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
  };
};

export async function fetchYouTubeOpportunities(options: SourceFetchOptions): Promise<SourceFetchResult> {
  if (!process.env.YOUTUBE_API_KEY) return notConfigured("YouTube", ["YOUTUBE_API_KEY"]);

  const sample = options.keywords.slice(0, 3).map((keyword, index) =>
    normalizePublicTextOpportunity({
      platform: "YouTube",
      sourceUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&sample=${index}`,
      authorHandle: "public_channel",
      text: `Public video/comment discussion about ${keyword} and Dubai property ROI.`,
    }),
  );
  if (options.dryRun) return dryRun("YouTube", sample);

  if (!sourceRateLimit("youtube")) {
    return { configured: true, status: "error", message: "YouTube rate limit active. Try again shortly.", opportunities: [] };
  }

  try {
    const query = options.keywords.slice(0, 5).join(" | ");
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", String(options.limit ?? 10));
    url.searchParams.set("key", process.env.YOUTUBE_API_KEY);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`YouTube Data API search failed: ${response.status}`);
    const data = (await response.json()) as { items?: YouTubeSearchItem[] };

    const opportunities = (data.items ?? []).map((item) =>
      normalizePublicTextOpportunity({
        platform: "YouTube",
        sourceUrl: item.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : "https://www.youtube.com",
        authorHandle: item.snippet?.channelTitle,
        text: `${item.snippet?.title ?? ""} ${item.snippet?.description ?? ""}`,
      }),
    );

    return { configured: true, status: "configured", message: "YouTube public video search completed.", opportunities };
  } catch (error) {
    return {
      configured: true,
      status: "error",
      message: error instanceof Error ? error.message : "YouTube fetch failed.",
      opportunities: [],
    };
  }
}
