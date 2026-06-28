import { normalizePublicTextOpportunity, sourceRateLimit } from "@/lib/sources/shared";
import type { SourceFetchOptions, SourceFetchResult } from "@/lib/sources/types";

type WebFetchOptions = SourceFetchOptions & {
  urls: string[];
};

const USER_AGENT = "DubaiLeadCRM-WebScraper/1.0 (+public-opportunity-monitor; respects robots.txt)";

export async function fetchWebOpportunities(options: WebFetchOptions): Promise<SourceFetchResult> {
  const urls = options.urls.map(normalizeUrl).filter(Boolean) as string[];

  if (urls.length === 0) {
    return {
      configured: false,
      status: "not_configured",
      message: "Public Web scraper needs at least one seed URL.",
      opportunities: [],
    };
  }

  if (options.dryRun) {
    return {
      configured: true,
      status: "dry_run",
      message: `Public Web dry run would check ${urls.length} URL${urls.length === 1 ? "" : "s"}.`,
      opportunities: urls.slice(0, options.limit ?? 10).map((url) =>
        normalizePublicTextOpportunity({
          platform: "Public Web",
          sourceUrl: url,
          authorHandle: new URL(url).hostname,
          text: `Dry run placeholder for ${url}. Configure real public pages that discuss Dubai property, ROI, areas, mortgage, relocation, or off-plan investment.`,
        }),
      ),
    };
  }

  if (!sourceRateLimit("public-web", 3000)) {
    return {
      configured: true,
      status: "error",
      message: "Public Web scraper rate limit active. Try again shortly.",
      opportunities: [],
    };
  }

  const opportunities = [];
  const errors: string[] = [];

  for (const url of urls.slice(0, options.limit ?? 20)) {
    try {
      const allowed = await robotsAllowed(url);
      if (!allowed) {
        errors.push(`${url}: blocked by robots.txt`);
        continue;
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        },
        signal: AbortSignal.timeout(12_000),
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
        errors.push(`${url}: unsupported response ${response.status}`);
        continue;
      }

      const html = await response.text();
      const text = htmlToText(html);
      const snippets = matchingSnippets(text, options.keywords).slice(0, 5);

      for (const [index, snippet] of snippets.entries()) {
        opportunities.push(
          normalizePublicTextOpportunity({
            platform: "Public Web",
            sourceUrl: `${url}${url.includes("#") ? "" : `#scrape-match-${index + 1}`}`,
            authorHandle: new URL(url).hostname,
            text: snippet,
          }),
        );
      }
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : "fetch failed"}`);
    }
  }

  return {
    configured: true,
    status: errors.length && opportunities.length === 0 ? "error" : "configured",
    message: errors.length ? `Public Web scan completed with warnings: ${errors.slice(0, 3).join("; ")}` : "Public Web scan completed.",
    opportunities,
  };
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

async function robotsAllowed(targetUrl: string) {
  const url = new URL(targetUrl);
  const robotsUrl = `${url.origin}/robots.txt`;
  try {
    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return true;
    const robots = await response.text();
    return isAllowedByRobots(robots, url.pathname || "/");
  } catch {
    return true;
  }
}

export function isAllowedByRobots(robots: string, pathname: string) {
  const lines = robots.split(/\r?\n/).map((line) => line.split("#")[0].trim());
  let applies = false;
  const disallows: string[] = [];
  const allows: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    const [rawKey, ...rawValue] = line.split(":");
    const key = rawKey.toLowerCase().trim();
    const value = rawValue.join(":").trim();

    if (key === "user-agent") {
      const agent = value.toLowerCase();
      applies = agent === "*" || agent.includes("dubaileadcrm");
      continue;
    }

    if (!applies) continue;
    if (key === "disallow" && value) disallows.push(value);
    if (key === "allow" && value) allows.push(value);
  }

  const longestAllow = longestMatch(pathname, allows);
  const longestDisallow = longestMatch(pathname, disallows);
  return longestAllow >= longestDisallow || longestDisallow === 0;
}

function longestMatch(pathname: string, rules: string[]) {
  return rules.reduce((longest, rule) => {
    const normalizedRule = rule.replace(/\*.*$/, "");
    if (!normalizedRule) return longest;
    return pathname.startsWith(normalizedRule) ? Math.max(longest, normalizedRule.length) : longest;
  }, 0);
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function matchingSnippets(text: string, keywords: string[]) {
  const normalizedText = text.toLowerCase();
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase()).filter((keyword) => keyword.length >= 3);
  const indexes = new Set<number>();

  for (const keyword of normalizedKeywords) {
    let index = normalizedText.indexOf(keyword);
    while (index !== -1 && indexes.size < 25) {
      indexes.add(index);
      index = normalizedText.indexOf(keyword, index + keyword.length);
    }
  }

  return Array.from(indexes)
    .sort((a, b) => a - b)
    .map((index) => cleanSnippet(text.slice(Math.max(index - 180, 0), Math.min(index + 520, text.length))))
    .filter((snippet, index, all) => snippet.length > 80 && !looksLikeNavigation(snippet) && all.findIndex((other) => other.slice(0, 120) === snippet.slice(0, 120)) === index);
}

function cleanSnippet(snippet: string) {
  const markers = [
    "Post new topic Subscribe",
    "Pictures home / Forum / United Arab Emirates / Dubai /",
    "home / Forum / United Arab Emirates / Dubai /",
  ];

  let cleaned = snippet;
  for (const marker of markers) {
    const index = cleaned.indexOf(marker);
    if (index !== -1) {
      cleaned = cleaned.slice(index + marker.length);
    }
  }

  return cleaned
    .replace(/Menu Search Magazine English Login Sign up Search Dubai Services Business directory Jobs Properties Classifieds Forum More Events Members/gi, " ")
    .replace(/Menu Search Magazine English Login Sign up Search/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeNavigation(snippet: string) {
  const normalized = snippet.toLowerCase();
  const navigationSignals = ["login sign up search", "business directory jobs properties classifieds", "menu search magazine"];
  return navigationSignals.some((signal) => normalized.includes(signal));
}
