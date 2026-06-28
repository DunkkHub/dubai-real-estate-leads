import { describe, expect, it } from "vitest";
import { normalizeYouTubeComment } from "../src/lib/sources/youtube";

describe("YouTube comment normalization", () => {
  it("stores top-level comment fields and buyer intent", () => {
    const opportunity = normalizeYouTubeComment({
      videoId: "abc123",
      commentId: "comment456",
      videoTitle: "Dubai property investment guide",
      authorDisplayName: "Public Viewer",
      commentText: "Looking to buy apartment in JVC under 900k this year. Is rental yield better than Dubai Marina?",
      publishedAt: "2026-06-01T10:00:00Z",
      likeCount: 7,
    });

    expect(opportunity.platform).toBe("YouTube");
    expect(opportunity.postId).toBe("abc123");
    expect(opportunity.commentId).toBe("comment456");
    expect(opportunity.authorHandle).toBe("Public Viewer");
    expect(opportunity.detectedBudget).toBe("900,000 AED");
    expect(opportunity.detectedArea).toBe("JVC");
    expect(opportunity.intentScore).toBeGreaterThanOrEqual(80);
    expect(opportunity.sourceUrl).toContain("lc=comment456");
  });
});
