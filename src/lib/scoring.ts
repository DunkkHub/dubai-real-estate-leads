import { DUBAI_AREAS, HOT_AREAS, TARGET_KEYWORDS } from "@/lib/constants";

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

const STRONG_BUYER_PATTERNS = [
  /\blooking to buy\b/i,
  /\bwant to buy\b/i,
  /\bwants to buy\b/i,
  /\bneed (?:an? )?(?:apartment|villa|property|flat|townhouse|studio)\b/i,
  /\bsearching for (?:an? )?(?:property|apartment|villa|flat|home)\b/i,
  /\blooking for (?:an? )?(?:property|apartment|villa|flat|home|investment)\b/i,
  /\bplanning to buy\b/i,
  /\bshould i buy\b/i,
  /\bbuying property\b/i,
];

const INVESTMENT_PATTERNS = [
  /\bmortgage\b/i,
  /\bcash buyer\b/i,
  /\broi\b/i,
  /\brental yield\b/i,
  /\byield\b/i,
  /\boff[- ]?plan\b/i,
  /\bcapital appreciation\b/i,
  /\bbuy[- ]?to[- ]?let\b/i,
];

const AGENT_SPAM_PATTERNS = [
  /\bagent\b.*\b(?:dm|contact|whatsapp|call)\b/i,
  /\b(?:dm|contact|call|whatsapp) me\b/i,
  /\blimited units\b/i,
  /\bdeveloper offer\b/i,
  /\boff[- ]?plan launch\b/i,
  /\bbook now\b/i,
  /\bzero commission\b/i,
  /\bguaranteed roi\b/i,
  /\bbroker\b.*\b(?:dm|contact|whatsapp|call|offer|deal)\b/i,
  /\breal estate agent\b.*\b(?:dm|contact|whatsapp|call|offer|deal)\b/i,
  /\b(?:for sale|for rent)\b.*\b(?:call|whatsapp|dm)\b/i,
];

const IRRELEVANT_PATTERNS = [
  /\bjob\b/i,
  /\bhiring\b/i,
  /\bcareer\b/i,
  /\bcomplaint\b/i,
  /\bscam\b/i,
  /\bfake listing\b/i,
  /\bgeneral news\b/i,
  /\bpress release\b/i,
  /\btraffic fine\b/i,
  /\bvisa\b/i,
  /\bschool project\b/i,
  /\bminor\b/i,
  /\bunder 18\b/i,
];

const AREA_ALIASES: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: "JVC", patterns: [/\bjvc\b/i, /\bjumeirah village circle\b/i] },
  { canonical: "Dubai Marina", patterns: [/\bdubai marina\b/i, /\bmarina\b/i] },
  { canonical: "Downtown", patterns: [/\bdowntown(?: dubai)?\b/i] },
  { canonical: "Business Bay", patterns: [/\bbusiness bay\b/i] },
  { canonical: "Dubai Hills", patterns: [/\bdubai hills\b/i] },
  { canonical: "JLT", patterns: [/\bjlt\b/i, /\bjumeirah lakes towers\b/i] },
  { canonical: "Arjan", patterns: [/\barjan\b/i] },
  { canonical: "Palm Jumeirah", patterns: [/\bpalm jumeirah\b/i, /\bthe palm\b/i] },
  ...DUBAI_AREAS.map((area) => ({ canonical: area, patterns: [new RegExp(`\\b${escapeRegExp(area)}\\b`, "i")] })),
];

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
  const text = input.text;
  const normalized = normalize(text);
  let score = 0;
  const detectedKeywords: string[] = [];
  const negativeSignals: string[] = [];

  const buyerIntent = detectBuyerIntent(text);
  const budget = extractBudget(text);
  const timeline = extractTimeline(text);
  const propertyType = extractPropertyType(text);
  const area = extractDubaiArea(text);
  const agentSpam = detectAgentSpam(text);
  const irrelevant = detectIrrelevant(text);

  if (buyerIntent) {
    score += 35;
    detectedKeywords.push("buyer intent");
  }

  if (budget) {
    score += 25;
    detectedKeywords.push("budget");
  }

  if (timeline) {
    score += 20;
    detectedKeywords.push("timeline");
  }

  if (INVESTMENT_PATTERNS.some((pattern) => pattern.test(text))) {
    score += 15;
    detectedKeywords.push("investment/mortgage");
  }

  if (area) {
    score += 10;
    detectedKeywords.push(area);
  }

  for (const keyword of TARGET_KEYWORDS) {
    if (normalized.includes(normalize(keyword)) && !detectedKeywords.includes(keyword)) {
      detectedKeywords.push(keyword);
      score += 4;
    }
  }

  if (agentSpam) {
    score -= 40;
    negativeSignals.push("agent spam or promotion");
  }

  if (irrelevant) {
    score -= 50;
    negativeSignals.push("irrelevant content");
  }

  if (!buyerIntent && !budget && !timeline && !INVESTMENT_PATTERNS.some((pattern) => pattern.test(text))) {
    score -= 15;
  }

  const intentScore = Math.max(0, Math.min(100, score));
  const intentCategory = classifyOpportunityIntent(text, intentScore);
  const sentiment = negativeSignals.length ? "negative" : intentScore >= 50 ? "positive" : "neutral";

  return {
    intentScore,
    scoreBand: opportunityScoreBand(intentScore),
    detectedKeywords: Array.from(new Set(detectedKeywords)),
    detectedArea: area,
    detectedBudget: budget,
    detectedTimeline: timeline,
    detectedPropertyType: propertyType,
    intentCategory,
    sentiment,
    shouldIgnore: intentScore < 20,
    negativeSignals,
  };
}

export function opportunityScoreBand(score: number) {
  if (score >= 80) return "HOT";
  if (score >= 50) return "WARM";
  if (score >= 20) return "LOW";
  return "IGNORE";
}

export function classifyOpportunityIntent(text: string, score: number) {
  const normalized = normalize(text);
  if (score < 20) return "IGNORE";
  if (normalized.includes("mortgage")) return "mortgage";
  if (normalized.includes("off-plan") || normalized.includes("off plan")) return "off-plan";
  if (normalized.includes("rent") || normalized.includes("rental")) return "rental search";
  if (normalized.includes("invest") || normalized.includes("roi") || normalized.includes("yield")) return "investment";
  if (normalized.includes("moving") || normalized.includes("relocate")) return "relocation";
  if (detectBuyerIntent(text)) return "buyer research";
  return "area research";
}

export function extractBudget(text: string) {
  const patterns = [
    /\b(?:under|below|max|maximum|up to|budget(?: is| around| of)?|around|approx(?:imately)?)\s*(?:aed|dh|dhs|dirhams?)?\s*([0-9]+(?:\.[0-9]+)?)\s*(m|mn|million|k|thousand)?\b/i,
    /\b(?:aed|dh|dhs|dirhams?)\s*([0-9]+(?:\.[0-9]+)?)\s*(m|mn|million|k|thousand)?\b/i,
    /\b([0-9]+(?:\.[0-9]+)?)\s*(m|mn|million|k|thousand)\s*(?:aed|dh|dhs|dirhams?)?\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = Number(match[1]);
      const suffix = (match[2] || "").toLowerCase();
      const value = suffix.startsWith("m") ? amount * 1_000_000 : suffix.startsWith("k") || suffix.startsWith("thousand") ? amount * 1_000 : amount;
      if (value >= 50_000) return `${Math.round(value).toLocaleString("en-US")} AED`;
    }
  }

  return null;
}

export function extractTimeline(text: string) {
  const patterns: Array<[RegExp, string]> = [
    [/\bnext month\b/i, "next month"],
    [/\bnext ([0-9]+) months?\b/i, "next $1 months"],
    [/\b0[- ]?3 months?\b/i, "0-3 months"],
    [/\b3[- ]?6 months?\b/i, "3-6 months"],
    [/\bmoving in ([a-z]+|[0-9]+ weeks?|[0-9]+ months?)\b/i, "moving in $1"],
    [/\bsoon\b/i, "soon"],
    [/\bthis year\b/i, "this year"],
    [/\bq([1-4])\b/i, "Q$1"],
  ];

  for (const [pattern, label] of patterns) {
    const match = text.match(pattern);
    if (match) return label.replace("$1", match[1] ?? "");
  }

  return null;
}

export function extractPropertyType(text: string) {
  const types: Array<[RegExp, string]> = [
    [/\bstudio\b/i, "Studio"],
    [/\bapartment|flat\b/i, "Apartment"],
    [/\bvilla\b/i, "Villa"],
    [/\btownhouse\b/i, "Townhouse"],
    [/\bpenthouse\b/i, "Penthouse"],
    [/\boffice\b/i, "Office"],
    [/\bproperty\b/i, "Property"],
  ];

  return types.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

export function extractDubaiArea(text: string) {
  for (const area of AREA_ALIASES) {
    if (area.patterns.some((pattern) => pattern.test(text))) return area.canonical;
  }
  return null;
}

export function detectAgentSpam(text: string) {
  return AGENT_SPAM_PATTERNS.some((pattern) => pattern.test(text));
}

export function detectBuyerIntent(text: string) {
  return STRONG_BUYER_PATTERNS.some((pattern) => pattern.test(text));
}

export function detectIrrelevant(text: string) {
  return IRRELEVANT_PATTERNS.some((pattern) => pattern.test(text));
}

export function suggestedPublicReply(text: string) {
  const { detectedArea } = scoreOpportunity({ text });
  const areaPhrase = detectedArea ? ` in ${detectedArea}` : "";
  return `If you're comparing options${areaPhrase}, the practical checks are budget, commute, service charges, developer/building history, and expected rent. I made a simple Dubai ROI and area checklist here if useful: ${process.env.APP_URL || "http://localhost:3000"}/calculator`;
}

function normalize(value?: string | null) {
  return (value ?? "").toLowerCase().trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
