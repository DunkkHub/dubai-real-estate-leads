import { DUBAI_AREAS, EXCLUDED_KEYWORDS, HOT_AREAS, TARGET_KEYWORDS } from "@/lib/constants";

export type LeadScoringInput = {
  budgetAed?: number | null;
  timeline?: string | null;
  purpose?: string | null;
  preferredArea?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  wantsMortgage?: boolean | null;
};

export type OpportunityScoringInput = {
  text: string;
  platform?: string;
};

export function scoreLead(input: LeadScoringInput) {
  let score = 0;
  const reasons: string[] = [];
  const budget = input.budgetAed ?? 0;
  const timeline = normalize(input.timeline);
  const purpose = normalize(input.purpose);
  const preferredArea = input.preferredArea ?? "";

  if (budget >= 2_000_000) {
    score += 30;
    reasons.push("Budget >= 2,000,000 AED");
  } else if (budget >= 1_000_000) {
    score += 20;
    reasons.push("Budget >= 1,000,000 AED");
  }

  if (timeline.includes("0-3") || timeline.includes("0 to 3")) {
    score += 30;
    reasons.push("Timeline 0-3 months");
  } else if (timeline.includes("3-6") || timeline.includes("3 to 6")) {
    score += 15;
    reasons.push("Timeline 3-6 months");
  }

  if (purpose.includes("investment")) {
    score += 15;
    reasons.push("Investment purpose");
  }

  if (HOT_AREAS.some((area) => normalize(area) === normalize(preferredArea))) {
    score += 10;
    reasons.push("Preferred hot area");
  }

  if (input.phone || input.whatsapp) {
    score += 10;
    reasons.push("Phone or WhatsApp provided");
  }

  if (input.email) {
    score += 5;
    reasons.push("Email provided");
  }

  if (input.wantsMortgage) {
    score += 10;
    reasons.push("Mortgage interest");
  }

  return {
    score,
    temperature: leadTemperature(score),
    reasons,
  };
}

export function leadTemperature(score: number) {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export function scoreOpportunity(input: OpportunityScoringInput) {
  const text = normalize(input.text);
  let score = 10;
  const detectedKeywords: string[] = [];
  const negativeSignals: string[] = [];

  const positiveSignals = [
    "buy",
    "invest",
    "investment",
    "mortgage",
    "relocate",
    "moving to dubai",
    "property",
    "apartment",
    "villa",
    "off-plan",
    "roi",
    "rent",
    "best area",
  ];

  for (const keyword of [...TARGET_KEYWORDS, ...positiveSignals]) {
    if (text.includes(normalize(keyword)) && !detectedKeywords.includes(keyword)) {
      detectedKeywords.push(keyword);
      score += keyword.length > 12 ? 12 : 7;
    }
  }

  for (const keyword of EXCLUDED_KEYWORDS) {
    if (text.includes(normalize(keyword))) {
      negativeSignals.push(keyword);
      score -= 35;
    }
  }

  if (/\b(i am|i'm|we are|looking|need|recommend|compare|budget)\b/.test(text)) score += 8;
  if (/\b\d{1,2}\s?(m|million|mn)\b/.test(text)) score += 10;
  if (/\b(job loss|divorce|medical|debt|visa overstay)\b/.test(text)) score -= 50;
  if (/\b(teen|kid|child|minor|underage|school assignment)\b/.test(text)) score -= 50;

  const detectedArea = DUBAI_AREAS.find((area) => text.includes(normalize(area))) ?? null;
  if (detectedArea) score += HOT_AREAS.includes(detectedArea) ? 10 : 5;

  const clamped = Math.max(0, Math.min(100, score));
  const intentCategory = classifyOpportunityIntent(text, clamped);
  const sentiment = negativeSignals.length > 0 ? "negative" : clamped >= 45 ? "positive" : "neutral";

  return {
    intentScore: clamped,
    detectedKeywords,
    detectedArea,
    intentCategory,
    sentiment,
    shouldIgnore: clamped < 15 || negativeSignals.length > 0,
    negativeSignals,
  };
}

export function classifyOpportunityIntent(text: string, score: number) {
  const normalized = normalize(text);
  if (score < 15) return "irrelevant";
  if (normalized.includes("mortgage")) return "mortgage";
  if (normalized.includes("off-plan") || normalized.includes("off plan")) return "off-plan";
  if (normalized.includes("rent")) return "rental search";
  if (normalized.includes("invest") || normalized.includes("roi")) return "investment";
  if (normalized.includes("moving") || normalized.includes("relocate")) return "relocation";
  if (normalized.includes("buy") || normalized.includes("apartment") || normalized.includes("villa")) return "buyer research";
  return "area research";
}

export function suggestedPublicReply(text: string) {
  const { detectedArea } = scoreOpportunity({ text });
  const areaPhrase = detectedArea ? ` in ${detectedArea}` : "";
  return `If you're comparing options${areaPhrase}, the practical checks are budget, commute, service charges, developer/building history, and expected rent. I made a simple Dubai ROI and area checklist here if useful: ${process.env.APP_URL || "http://localhost:3000"}/calculator`;
}

function normalize(value?: string | null) {
  return (value ?? "").toLowerCase().trim();
}
