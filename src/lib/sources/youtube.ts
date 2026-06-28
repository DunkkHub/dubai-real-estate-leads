import { dryRun, normalizePublicTextOpportunity, notConfigured, sourceRateLimit } from "@/lib/sources/shared";
import type { NormalizedOpportunity, SourceFetchOptions, SourceFetchResult } from "@/lib/sources/types";

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
};

type YouTubeCommentThread = {
  id: string;
  snippet?: {
    videoId?: string;
    topLevelComment?: {
      id?: string;
      snippet?: {
        authorDisplayName?: string;
        textDisplay?: string;
        textOriginal?: string;
        publishedAt?: string;
        likeCount?: number;
      };
    };
  };
};

const DEFAULT_YOUTUBE_QUERIES = [
  "Dubai property investment",
  "buy apartment Dubai",
  "Dubai mortgage",
  "off-plan Dubai",
  "Dubai rental yield",
];

export async function fetchYouTubeOpportunities(options: SourceFetchOptions): Promise<SourceFetchResult> {
  if (!process.env.YOUTUBE_API_KEY) return notConfigured("YouTube", ["YOUTUBE_API_KEY"]);

  const sample = options.keywords.slice(0, 3).map((keyword, index) =>
    normalizeYouTubeComment({
      videoId: `dry-video-${index}`,
      commentId: `dry-comment-${index}`,
      videoTitle: `Dubai real estate discussion: ${keyword}`,
      authorDisplayName: "public_commenter",
      commentText: `Looking to buy an apartment in Dubai with budget around 1M AED this year. Comparing JVC and Dubai Marina ROI.`,
      publishedAt: new Date().toISOString(),
      likeCount: 0,
    }),
  );
  if (options.dryRun) return dryRun("YouTube", sample);

  if (!sourceRateLimit("youtube", 2000)) {
    return { configured: true, status: "error", message: "YouTube rate limit active. Try again shortly.", opportunities: [] };
  }

  try {
    const videos = await searchYouTubeVideos(options);
    const opportunities: NormalizedOpportunity[] = [];

    for (const video of videos) {
      const videoId = video.id?.videoId;
      if (!videoId) continue;
      const comments = await fetchYouTubeComments(videoId, Math.min(options.limit ?? 30, 100));
      for (const comment of comments) {
        const top = comment.snippet?.topLevelComment;
        const snippet = top?.snippet;
        const normalized = normalizeYouTubeComment({
          videoId,
          commentId: top?.id ?? comment.id,
          videoTitle: video.snippet?.title ?? "YouTube video",
          authorDisplayName: snippet?.authorDisplayName,
          commentText: snippet?.textOriginal || stripHtml(snippet?.textDisplay ?? ""),
          publishedAt: snippet?.publishedAt,
          likeCount: snippet?.likeCount,
          rawJson: comment as unknown as Record<string, unknown>,
        });
        if (normalized.intentScore >= 20) opportunities.push(normalized);
      }
    }

    return { configured: true, status: "configured", message: `YouTube comment scrape completed from ${videos.length} videos.`, opportunities };
  } catch (error) {
    return {
      configured: true,
      status: "error",
      message: error instanceof Error ? error.message : "YouTube fetch failed.",
      opportunities: [],
    };
  }
}

export function normalizeYouTubeComment(input: {
  videoId: string;
  commentId: string;
  videoTitle: string;
  authorDisplayName?: string | null;
  commentText?: string | null;
  publishedAt?: string | null;
  likeCount?: number | null;
  rawJson?: Record<string, unknown>;
}) {
  const text = input.commentText ?? "";
  return normalizePublicTextOpportunity({
    platform: "YouTube",
    sourceUrl: `https://www.youtube.com/watch?v=${input.videoId}&lc=${input.commentId}`,
    title: input.videoTitle,
    externalId: input.commentId,
    postId: input.videoId,
    commentId: input.commentId,
    authorHandle: input.authorDisplayName,
    text,
    scrapedAt: new Date(),
    rawJson: {
      videoId: input.videoId,
      commentId: input.commentId,
      videoTitle: input.videoTitle,
      authorDisplayName: input.authorDisplayName ?? null,
      commentText: text,
      publishedAt: input.publishedAt ?? null,
      likeCount: input.likeCount ?? 0,
      ...(input.rawJson ?? {}),
    },
  });
}

async function searchYouTubeVideos(options: SourceFetchOptions) {
  const query = [...new Set([...DEFAULT_YOUTUBE_QUERIES, ...options.keywords])].slice(0, 8).join(" | ");
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("maxResults", String(Math.min(options.limit ?? 10, 25)));
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY || "");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube Data API search failed: ${response.status}`);
  const data = (await response.json()) as { items?: YouTubeSearchItem[] };
  return data.items ?? [];
}

async function fetchYouTubeComments(videoId: string, maxResults: number) {
  const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("videoId", videoId);
  url.searchParams.set("textFormat", "plainText");
  url.searchParams.set("order", "relevance");
  url.searchParams.set("maxResults", String(Math.min(Math.max(maxResults, 1), 100)));
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY || "");

  const response = await fetch(url);
  if (response.status === 403 || response.status === 404) return [];
  if (!response.ok) throw new Error(`YouTube commentThreads.list failed for ${videoId}: ${response.status}`);
  const data = (await response.json()) as { items?: YouTubeCommentThread[] };
  return data.items ?? [];
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}
