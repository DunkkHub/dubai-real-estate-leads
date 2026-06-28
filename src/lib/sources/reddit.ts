import { dryRun, normalizePublicTextOpportunity, notConfigured, sourceRateLimit } from "@/lib/sources/shared";
import type { NormalizedOpportunity, SourceFetchOptions, SourceFetchResult } from "@/lib/sources/types";

type RedditPost = {
  id?: string;
  name?: string;
  title?: string;
  selftext?: string;
  permalink?: string;
  author?: string;
  subreddit?: string;
  created_utc?: number;
  score?: number;
};

type RedditListingChild = {
  kind?: string;
  data?: RedditPost | RedditComment;
};

type RedditComment = {
  id?: string;
  name?: string;
  body?: string;
  permalink?: string;
  author?: string;
  subreddit?: string;
  parent_id?: string;
  link_id?: string;
  created_utc?: number;
  score?: number;
};

export const TARGET_SUBREDDITS = ["dubai", "dubai_real_estate", "UAE", "UAERealEstate", "realestateinvesting", "expats"];

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
    normalizeRedditComment({
      post: {
        id: `dry-post-${index}`,
        title: `Moving to Dubai and comparing ${keyword}`,
        permalink: `/r/dubai/comments/dry${index}/sample/`,
        subreddit: "dubai",
      },
      comment: {
        id: `dry-comment-${index}`,
        body: `Looking to buy apartment in Dubai, budget under 1M AED, moving in next month. Is JVC better than Dubai Marina?`,
        author: "public_reddit_user",
        subreddit: "dubai",
        created_utc: Date.now() / 1000,
        score: 3,
      },
    }),
  );
  if (options.dryRun) return dryRun("Reddit", sample);

  if (!sourceRateLimit("reddit", 2500)) {
    return { configured: true, status: "error", message: "Reddit rate limit active. Try again shortly.", opportunities: [] };
  }

  try {
    const token = await redditToken();
    if (!token) return notConfigured("Reddit", missing);

    const opportunities: NormalizedOpportunity[] = [];
    const query = options.keywords.slice(0, 8).map((keyword) => `"${keyword}"`).join(" OR ");

    for (const subreddit of TARGET_SUBREDDITS) {
      const posts = await searchSubredditPosts(token, subreddit, query, Math.min(options.limit ?? 10, 25));
      for (const post of posts) {
        const postOpportunity = normalizeRedditPost(post);
        if (postOpportunity.intentScore >= 20) opportunities.push(postOpportunity);

        const comments = await fetchPostComments(token, post.id, Math.min(options.limit ?? 25, 100));
        for (const comment of comments) {
          const commentOpportunity = normalizeRedditComment({ post, comment });
          if (commentOpportunity.intentScore >= 20) opportunities.push(commentOpportunity);
        }
      }
    }

    return { configured: true, status: "configured", message: `Reddit scrape completed across ${TARGET_SUBREDDITS.length} subreddits.`, opportunities };
  } catch (error) {
    return {
      configured: true,
      status: "error",
      message: error instanceof Error ? error.message : "Reddit fetch failed.",
      opportunities: [],
    };
  }
}

export function normalizeRedditPost(post: RedditPost) {
  const postId = post.id ?? post.name ?? "";
  const sourceUrl = post.permalink ? `https://www.reddit.com${post.permalink}` : `https://www.reddit.com/comments/${postId}`;
  const text = `${post.title ?? ""}\n${post.selftext ?? ""}`;

  return normalizePublicTextOpportunity({
    platform: "Reddit",
    sourceUrl,
    title: post.title,
    externalId: post.name ?? postId,
    postId,
    authorHandle: publicAuthor(post.author),
    text,
    scrapedAt: new Date(),
    rawJson: {
      type: "post",
      postId,
      title: post.title ?? null,
      selftext: post.selftext ?? null,
      subreddit: post.subreddit ?? null,
      author: publicAuthor(post.author),
      permalink: post.permalink ?? null,
      created_utc: post.created_utc ?? null,
      score: post.score ?? 0,
    },
  });
}

export function normalizeRedditComment({ post, comment }: { post: RedditPost; comment: RedditComment }) {
  const postId = post.id ?? comment.link_id?.replace(/^t3_/, "") ?? "";
  const commentId = comment.id ?? comment.name ?? "";
  const sourceUrl = comment.permalink
    ? `https://www.reddit.com${comment.permalink}`
    : post.permalink
      ? `https://www.reddit.com${post.permalink}${commentId ? commentId : ""}`
      : `https://www.reddit.com/comments/${postId}/comment/${commentId}`;

  return normalizePublicTextOpportunity({
    platform: "Reddit",
    sourceUrl,
    title: post.title,
    externalId: comment.name ?? commentId,
    postId,
    commentId,
    authorHandle: publicAuthor(comment.author),
    text: comment.body ?? "",
    scrapedAt: new Date(),
    rawJson: {
      type: "comment",
      postId,
      commentId,
      postTitle: post.title ?? null,
      body: comment.body ?? null,
      subreddit: comment.subreddit ?? post.subreddit ?? null,
      author: publicAuthor(comment.author),
      permalink: comment.permalink ?? post.permalink ?? null,
      created_utc: comment.created_utc ?? null,
      score: comment.score ?? 0,
    },
  });
}

async function searchSubredditPosts(token: string, subreddit: string, query: string, limit: number) {
  const url = new URL(`https://oauth.reddit.com/r/${subreddit}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("restrict_sr", "1");
  url.searchParams.set("sort", "new");
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": process.env.REDDIT_USER_AGENT || "DubaiLeadCRM/1.0",
    },
  });

  if (!response.ok) return [];
  const data = (await response.json()) as { data?: { children?: RedditListingChild[] } };
  return (data.data?.children ?? []).map((child) => child.data).filter(Boolean) as RedditPost[];
}

async function fetchPostComments(token: string, postId?: string, limit = 50) {
  if (!postId) return [];
  const url = new URL(`https://oauth.reddit.com/comments/${postId}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("depth", "1");
  url.searchParams.set("sort", "confidence");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": process.env.REDDIT_USER_AGENT || "DubaiLeadCRM/1.0",
    },
  });

  if (!response.ok) return [];
  const listings = (await response.json()) as Array<{ data?: { children?: RedditListingChild[] } }>;
  const comments = listings[1]?.data?.children ?? [];
  return comments.filter((child) => child.kind === "t1").map((child) => child.data).filter(Boolean) as RedditComment[];
}

function publicAuthor(author?: string | null) {
  if (!author || author === "[deleted]" || author === "AutoModerator") return null;
  return author;
}
