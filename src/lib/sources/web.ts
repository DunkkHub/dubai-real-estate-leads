import * as cheerio from "cheerio";
import { hashText } from "@/lib/scraper/dedupe";
import { normalizePublicTextOpportunity, sourceRateLimit } from "@/lib/sources/shared";
import type { SourceFetchOptions, SourceFetchResult } from "@/lib/sources/types";

type WebFetchOptions = SourceFetchOptions & {
  urls: string[];
  selector?: string | null;
  paginationTemplate?: string | null;
  maxPages?: number;
  delayMs?: number;
  timeoutMs?: number;
};

const USER_AGENT = "DubaiLeadCRM-WebScraper/1.0 (+public-opportunity-monitor; respects robots.txt)";

export async function fetchWebOpportunities(options: WebFetchOptions): Promise<SourceFetchResult> {
  const urls = expandPaginatedUrls(options)
    .map(normalizeUrl)
    .filter(Boolean) as string[];
  const selector = options.selector?.trim() || null;
  const delayMs = Math.max(options.delayMs ?? 1200, 0);
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 12_000, 3000), 30_000);

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
      opportunities: urls.slice(0, options.limit ?? 10).map((url, index) =>
        normalizePublicTextOpportunity({
          platform: "Public Web",
          sourceUrl: url,
          title: `Dry run page ${index + 1}`,
          externalId: hashText(url),
          authorHandle: new URL(url).hostname,
          text: `Looking to buy apartment in Dubai with 1M AED budget this year. Comparing JVC, Dubai Marina, mortgage, ROI and rental yield on ${url}.`,
          rawJson: { url, selector, dryRun: true },
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
  const seenTextHashes = new Set<string>();

  for (const url of urls.slice(0, options.limit ?? 50)) {
    try {
      const allowed = await robotsAllowed(url, timeoutMs);
      if (!allowed) {
        errors.push(`${url}: blocked by robots.txt`);
        continue;
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
        errors.push(`${url}: unsupported response ${response.status}`);
        continue;
      }

      const html = await response.text();
      const title = extractTitle(html);
      const textBlocks = selector ? extractSelectorText(html, selector) : [htmlToText(html)];
      const snippets = textBlocks.flatMap((text) => matchingSnippets(text, options.keywords)).slice(0, 10);

      for (const [index, snippet] of snippets.entries()) {
        const textHash = hashText(snippet);
        if (seenTextHashes.has(textHash)) continue;
        seenTextHashes.add(textHash);

        opportunities.push(
          normalizePublicTextOpportunity({
            platform: "Public Web",
            sourceUrl: `${url}${url.includes("#") ? "" : `#scrape-match-${index + 1}`}`,
            title,
            externalId: textHash,
            authorHandle: new URL(url).hostname,
            text: snippet,
            rawJson: { url, selector, textHash, title },
          }),
        );
      }

      if (delayMs > 0) await sleep(delayMs);
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

function expandPaginatedUrls(options: WebFetchOptions) {
  const maxPages = Math.min(Math.max(options.maxPages ?? 1, 1), 20);
  if (!options.paginationTemplate) return options.urls;

  const urls = [...options.urls];
  for (let page = 1; page <= maxPages; page += 1) {
    urls.push(options.paginationTemplate.replaceAll("{page}", String(page)));
  }
  return Array.from(new Set(urls));
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

async function robotsAllowed(targetUrl: string, timeoutMs: number) {
  const url = new URL(targetUrl);
  const robotsUrl = `${url.origin}/robots.txt`;
  try {
    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(Math.min(timeoutMs, 5000)),
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

function extractSelectorText(html: string, selector: string) {
  const $ = cheerio.load(html);
  const blocks: string[] = [];
  $(selector).each((_, element) => {
    const text = cleanSnippet($(element).text());
    if (text.length > 80) blocks.push(text);
  });
  return blocks.length ? blocks : [htmlToText(html)];
}

function extractTitle(html: string) {
  const $ = cheerio.load(html);
  return cleanSnippet($("title").first().text()).slice(0, 180) || null;
}

function htmlToText(html: string) {
  const $ = cheerio.load(html);
  $("script,style,noscript,svg,iframe,form,nav,header,footer").remove();
  return cleanSnippet($.text());
}

function matchingSnippets(text: string, keywords: string[]) {
  const normalizedText = text.toLowerCase();
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase()).filter((keyword) => keyword.length >= 3);
  const indexes = new Set<number>();

  for (const keyword of normalizedKeywords) {
    let index = normalizedText.indexOf(keyword);
    while (index !== -1 && indexes.size < 50) {
      indexes.add(index);
      index = normalizedText.indexOf(keyword, index + keyword.length);
    }
  }

  return Array.from(indexes)
    .sort((a, b) => a - b)
    .map((index) => cleanSnippet(text.slice(Math.max(index - 220, 0), Math.min(index + 620, text.length))))
    .filter((snippet, index, all) => snippet.length > 80 && !looksLikeNavigation(snippet) && all.findIndex((other) => hashText(other) === hashText(snippet)) === index);
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
    if (index !== -1) cleaned = cleaned.slice(index + marker.length);
  }

  return cleaned
    .replace(/Menu Search Magazine English Login Sign up Search Dubai Services Business directory Jobs Properties Classifieds Forum More Events Members/gi, " ")
    .replace(/Menu Search Magazine English Login Sign up Search/gi, " ")
    .replace(/Buy Rent للبيع للايجار Skip to content/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeNavigation(snippet: string) {
  const normalized = snippet.toLowerCase();
  const navigationSignals = ["login sign up search", "business directory jobs properties classifieds", "menu search magazine"];
  return navigationSignals.some((signal) => normalized.includes(signal));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
