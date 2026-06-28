import "dotenv/config";
import { TARGET_KEYWORDS } from "../src/lib/constants";
import { prisma } from "../src/lib/prisma";
import { createScrapeJob, finishScrapeJob, saveOpportunities } from "../src/lib/scraper/save";
import { fetchRedditOpportunities } from "../src/lib/sources/reddit";
import { fetchWebOpportunities } from "../src/lib/sources/web";
import { fetchXOpportunities } from "../src/lib/sources/x";
import { fetchYouTubeOpportunities } from "../src/lib/sources/youtube";
import type { SourceFetchResult } from "../src/lib/sources/types";

type SourceName = "reddit" | "youtube" | "x" | "web";

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

async function main() {
  const requested = (process.argv[2] || "all").toLowerCase();
  const sources: SourceName[] =
    requested === "all"
      ? ["reddit", "youtube", "x", "web"]
      : ["reddit", "youtube", "x", "web"].includes(requested)
        ? [requested as SourceName]
        : [];

  if (sources.length === 0) {
    console.error("Usage: pnpm scrape:<reddit|youtube|x|web|all>");
    process.exitCode = 1;
    return;
  }

  const keywords = await loadKeywords();
  const summaries = [];

  for (const source of sources) {
    const query = keywords.slice(0, 12).join(" | ");
    const job = await createScrapeJob(source, query);
    let result: SourceFetchResult;
    let savedCount = 0;

    try {
      result = await fetchSource(source, keywords);
      savedCount = result.status === "configured" ? await saveOpportunities(result.opportunities) : 0;

      await finishScrapeJob({
        id: job.id,
        status: result.status === "error" ? "FAILED" : "SUCCESS",
        resultsCount: result.opportunities.length,
        savedCount,
        error: result.status === "error" ? result.message : result.status === "not_configured" ? result.message : null,
      });

      summaries.push({ source, status: result.status, found: result.opportunities.length, saved: savedCount, message: result.message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown scrape failure";
      await finishScrapeJob({
        id: job.id,
        status: "FAILED",
        resultsCount: 0,
        savedCount: 0,
        error: message,
      });
      summaries.push({ source, status: "error", found: 0, saved: 0, message });
    }
  }

  console.log(JSON.stringify({ ok: true, summaries }, null, 2));
}

async function fetchSource(source: SourceName, keywords: string[]) {
  if (source === "reddit") return fetchRedditOpportunities({ keywords, limit: 20 });
  if (source === "youtube") return fetchYouTubeOpportunities({ keywords, limit: 10 });
  if (source === "x") return fetchXOpportunities({ keywords, limit: 25 });
  return fetchWebOpportunities(await webOptions(keywords));
}

async function loadKeywords() {
  const rows = await prisma.keywordConfig.findMany({
    where: { type: "TARGET", enabled: true },
    orderBy: { value: "asc" },
  });
  return rows.length ? rows.map((row) => row.value) : TARGET_KEYWORDS;
}

async function webOptions(keywords: string[]) {
  const config = await prisma.sourceConfig.findUnique({ where: { platform: "Public Web" } });
  const object = sourceConfigObject(config?.config);
  return {
    keywords,
    limit: 50,
    urls: sourceConfigUrls(object),
    selector: stringConfig(object.selector),
    paginationTemplate: stringConfig(object.paginationTemplate),
    maxPages: numberConfig(object.maxPages, 1),
    delayMs: numberConfig(object.delayMs, 1200),
    timeoutMs: numberConfig(object.timeoutMs, 12000),
  };
}

function sourceConfigUrls(config: Record<string, unknown>) {
  return Array.isArray(config.urls) ? config.urls.filter((url): url is string => typeof url === "string") : [];
}

function sourceConfigObject(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  return config as Record<string, unknown>;
}

function stringConfig(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberConfig(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
