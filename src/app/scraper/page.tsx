import Link from "next/link";
import { Download, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { syncSourceAction } from "@/app/actions/crm";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { opportunityScoreBand } from "@/lib/scoring";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ScraperPage() {
  const user = await requireUser();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [scrapedToday, hot, warm, ignored, sourceGroups, lastJob, opportunities] = await Promise.all([
    prisma.opportunity.count({ where: { scrapedAt: { gte: startOfToday } } }),
    prisma.opportunity.count({ where: { intentScore: { gte: 80 } } }),
    prisma.opportunity.count({ where: { intentScore: { gte: 50, lt: 80 } } }),
    prisma.opportunity.count({ where: { intentScore: { lt: 20 } } }),
    prisma.opportunity.groupBy({ by: ["platform"], _count: { platform: true }, orderBy: { _count: { platform: "desc" } }, take: 1 }),
    prisma.scrapeJob.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.opportunity.findMany({
      orderBy: [{ scrapedAt: "desc" }, { intentScore: "desc" }],
      take: 100,
    }),
  ]);

  const bestSource = sourceGroups[0]?.platform ? `${sourceGroups[0].platform} (${sourceGroups[0]._count.platform})` : "None";

  return (
    <AppShell userName={user.name}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950">Scraper</h1>
            <p className="mt-1 text-sm text-stone-600">Public buyer and investor intent. No private contacts, no login-protected scraping, no CRM lead creation without opt-in.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={syncSourceAction}>
              <input type="hidden" name="platform" value="All" />
              <SubmitButton pendingText="Scraping...">
                <Play className="h-4 w-4" aria-hidden="true" />
                Run scraper
              </SubmitButton>
            </form>
            <a className={buttonClassName("secondary")} href="/api/opportunities/export">
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </a>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Kpi title="Scraped today" value={scrapedToday} />
          <Kpi title="Hot opportunities" value={hot} />
          <Kpi title="Warm opportunities" value={warm} />
          <Kpi title="Ignored" value={ignored} />
          <Kpi title="Best source" value={bestSource} />
          <Kpi title="Last job" value={lastJob ? `${lastJob.source}: ${lastJob.status}` : "None"} />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Scraped opportunities</CardTitle>
            <CardDescription>Sorted by newest scrape, then score. Rows below 20 are kept for audit but classified as IGNORE.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead className="text-left text-xs uppercase text-stone-500">
                  <tr className="border-b border-stone-200">
                    <th className="py-3 pr-4">Score</th>
                    <th className="py-3 pr-4">Source</th>
                    <th className="py-3 pr-4">Title</th>
                    <th className="py-3 pr-4">Snippet</th>
                    <th className="py-3 pr-4">Area</th>
                    <th className="py-3 pr-4">Budget</th>
                    <th className="py-3 pr-4">Timeline</th>
                    <th className="py-3 pr-4">URL</th>
                    <th className="py-3 pr-4">Scraped</th>
                    <th className="py-3 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((opportunity) => {
                    const band = opportunityScoreBand(opportunity.intentScore);
                    return (
                      <tr key={opportunity.id} className="border-b border-stone-100">
                        <td className="py-3 pr-4"><Badge tone={band === "HOT" ? "hot" : band === "WARM" ? "warm" : "default"}>{opportunity.intentScore} {band}</Badge></td>
                        <td className="py-3 pr-4 text-stone-700">{opportunity.platform}</td>
                        <td className="max-w-56 py-3 pr-4 text-stone-900">{opportunity.title || "Untitled"}</td>
                        <td className="max-w-xl py-3 pr-4 leading-6 text-stone-700">{opportunity.publicTextSnippet}</td>
                        <td className="py-3 pr-4 text-stone-700">{opportunity.detectedArea || "None"}</td>
                        <td className="py-3 pr-4 text-stone-700">{opportunity.detectedBudget || "None"}</td>
                        <td className="py-3 pr-4 text-stone-700">{opportunity.detectedTimeline || "None"}</td>
                        <td className="py-3 pr-4"><Link className="text-emerald-800 underline" href={opportunity.sourceUrl} target="_blank">Open</Link></td>
                        <td className="py-3 pr-4 text-stone-700">{formatDate(opportunity.scrapedAt || opportunity.createdAt)}</td>
                        <td className="py-3 pr-4 text-stone-700">{opportunity.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {opportunities.length === 0 ? <div className="p-8 text-center text-sm text-stone-600">No scraped opportunities yet. Run a scraper from this page or use the CLI.</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Kpi({ title, value }: { title: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase text-stone-500">{title}</p>
        <p className="mt-2 text-xl font-semibold tabular-nums text-stone-950">{value}</p>
      </CardContent>
    </Card>
  );
}
