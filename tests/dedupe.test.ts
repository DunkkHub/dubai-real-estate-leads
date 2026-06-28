import { describe, expect, it } from "vitest";
import { hashText, opportunityDedupeHash } from "../src/lib/scraper/dedupe";

describe("duplicate detection", () => {
  it("normalizes equivalent text before hashing", () => {
    expect(hashText(" Looking   to BUY apartment Dubai ")).toBe(hashText("looking to buy apartment dubai"));
  });

  it("prefers stable platform external ids over URL-only uniqueness", () => {
    const a = opportunityDedupeHash({
      platform: "YouTube",
      externalId: "comment-123",
      postId: "video-1",
      commentId: "comment-123",
      sourceUrl: "https://youtube.com/watch?v=video-1&lc=comment-123",
      text: "Looking to buy apartment in Dubai",
    });
    const b = opportunityDedupeHash({
      platform: "YouTube",
      externalId: "comment-123",
      postId: "video-1",
      commentId: "comment-123",
      sourceUrl: "https://m.youtube.com/watch?v=video-1&lc=comment-123",
      text: "Different URL wrapper",
    });

    expect(a).toBe(b);
  });
});
