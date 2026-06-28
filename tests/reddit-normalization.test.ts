import { describe, expect, it } from "vitest";
import { normalizeRedditComment } from "../src/lib/sources/reddit";

describe("Reddit comment normalization", () => {
  it("stores comment and post ids separately with strong buyer intent", () => {
    const opportunity = normalizeRedditComment({
      post: {
        id: "post123",
        title: "Moving to Dubai property advice",
        subreddit: "dubai",
        permalink: "/r/dubai/comments/post123/moving_to_dubai_property_advice/",
      },
      comment: {
        id: "comment789",
        body: "Want to buy a villa in Dubai Hills, budget 2 million AED, moving in next 3 months. Mortgage or cash buyer options?",
        author: "public_redditor",
        subreddit: "dubai",
        created_utc: 1_780_000_000,
        score: 12,
      },
    });

    expect(opportunity.platform).toBe("Reddit");
    expect(opportunity.postId).toBe("post123");
    expect(opportunity.commentId).toBe("comment789");
    expect(opportunity.authorHandle).toBe("public_redditor");
    expect(opportunity.detectedBudget).toBe("2,000,000 AED");
    expect(opportunity.detectedPropertyType).toBe("Villa");
    expect(opportunity.detectedArea).toBe("Dubai Hills");
    expect(opportunity.intentScore).toBeGreaterThanOrEqual(80);
  });
});
