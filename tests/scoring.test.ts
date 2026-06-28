import { describe, expect, it } from "vitest";
import { scoreLead, scoreOpportunity } from "../src/lib/scoring";

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
      text: "Moving to Dubai in 0-3 months and want to buy apartment Dubai Marina with mortgage.",
    });

    expect(result.intentScore).toBeGreaterThanOrEqual(50);
    expect(result.detectedArea).toBe("Dubai Marina");
    expect(result.shouldIgnore).toBe(false);
  });

  it("filters spam and irrelevant/minor situations", () => {
    const result = scoreOpportunity({
      text: "School project by a minor, not interested in buying and tired of agent spam.",
    });

    expect(result.shouldIgnore).toBe(true);
    expect(result.intentCategory).toBe("irrelevant");
  });
});
