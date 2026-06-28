import { describe, expect, it } from "vitest";
import { detectAgentSpam, detectBuyerIntent, extractBudget, extractDubaiArea, extractPropertyType, extractTimeline, scoreLead, scoreOpportunity } from "../src/lib/scoring";

describe("lead scoring", () => {
  it("marks high budget urgent investment leads as hot", () => {
    const result = scoreLead({
      budgetAed: 2_500_000,
      timeline: "0-3 months",
      purpose: "investment",
      preferredArea: "Dubai Marina",
      email: "buyer@example.com",
      whatsapp: "+971500000000",
      wantsMortgage: true,
    });

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.temperature).toBe("hot");
  });

  it("keeps low-intent sparse leads cold", () => {
    const result = scoreLead({
      budgetAed: 300_000,
      timeline: "12+ months",
      purpose: "living",
      preferredArea: "JLT",
    });

    expect(result.score).toBeLessThan(40);
    expect(result.temperature).toBe("cold");
  });
});

describe("opportunity scoring", () => {
  it("detects high-intent Dubai property conversations", () => {
    const result = scoreOpportunity({
      text: "Looking to buy apartment in Dubai Marina with mortgage. Budget around 1M AED and moving in next month.",
    });

    expect(result.intentScore).toBeGreaterThanOrEqual(80);
    expect(result.detectedArea).toBe("Dubai Marina");
    expect(result.detectedBudget).toBe("1,000,000 AED");
    expect(result.detectedTimeline).toBe("next month");
    expect(result.detectedPropertyType).toBe("Apartment");
    expect(result.shouldIgnore).toBe(false);
  });

  it("filters spam and irrelevant/minor situations", () => {
    const result = scoreOpportunity({
      text: "Developer offer. Limited units. WhatsApp me now for guaranteed ROI. Also this is a school project by a minor.",
    });

    expect(result.shouldIgnore).toBe(true);
    expect(result.intentCategory).toBe("IGNORE");
    expect(result.intentScore).toBeLessThan(20);
  });
});

describe("opportunity extraction", () => {
  it("extracts budget, timeline, property type, and Dubai area", () => {
    const text = "Want to buy a villa in Dubai Hills under 2 million this year, cash buyer.";

    expect(extractBudget(text)).toBe("2,000,000 AED");
    expect(extractTimeline(text)).toBe("this year");
    expect(extractPropertyType(text)).toBe("Villa");
    expect(extractDubaiArea(text)).toBe("Dubai Hills");
    expect(detectBuyerIntent(text)).toBe(true);
    expect(detectAgentSpam(text)).toBe(false);
  });
});
