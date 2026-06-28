import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadStagesChart, SourcePerformanceChart } from "@/components/charts/dashboard-charts";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatAed } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalOpportunities, newToday, optInLeads, hotLeads, opportunitiesByPlatform, leadsBySource, stageCounts, recentLeads] =
    await Promise.all([
      prisma.opportunity.count(),
      prisma.opportunity.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.lead.count({ where: { consentStatus: "ACTIVE" } }),
      prisma.lead.count({ where: { score: { gte: 70 }, consentStatus: "ACTIVE" } }),
      prisma.opportunity.groupBy({ by: ["platform"], _count: true }),
      prisma.lead.groupBy({ by: ["source"], _count: true }),
      prisma.lead.groupBy({ by: ["stage"], _count: true }),
      prisma.lead.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
    ]);

  const conversionRate = totalOpportunities ? Math.round((optInLeads / totalOpportunities) * 100) : 0;
  const chartSources = Array.from(new Set([...opportunitiesByPlatform.map((item) => item.platform), ...leadsBySource.map((item) => item.source)])).map(
    (source) => ({
      source,
      opportunities: opportunitiesByPlatform.find((item) => item.platform === source)?._count ?? 0,
      leads: leadsBySource.find((item) => item.source === source)?._count ?? 0,
    }),
  );

  return (
    <AppShell userName={user.name}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-950">Dashboard</h1>
          <p className="mt-1 text-sm text-stone-600">Public opportunities stay separate from consented CRM leads.</p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi title="Total opportunities" value={totalOpportunities} />
          <Kpi title="New today" value={newToday} />
          <Kpi title="Opt-in leads" value={optInLeads} />
          <Kpi title="Hot leads" value={hotLeads} />
          <Kpi title="Conversion" value={`${conversionRate}%`} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Source performance</CardTitle>
              <CardDescription>Opportunities compared with consented leads.</CardDescription>
            </CardHeader>
            <CardContent>
              {chartSources.length ? <SourcePerformanceChart data={chartSources} /> : <Empty text="No source data yet." />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lead stages</CardTitle>
              <CardDescription>Pipeline distribution for consented leads.</CardDescription>
            </CardHeader>
            <CardContent>
              {stageCounts.length ? (
                <LeadStagesChart data={stageCounts.map((item) => ({ stage: item.stage, count: item._count }))} />
              ) : (
                <Empty text="No leads yet." />
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Recent opt-in leads</CardTitle>
            <CardDescription>Only people with an active consent record appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead className="text-left text-xs uppercase text-stone-500">
                  <tr className="border-b border-stone-200">
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Area</th>
                    <th className="py-3 pr-4">Budget</th>
                    <th className="py-3 pr-4">Score</th>
                    <th className="py-3 pr-4">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-stone-100">
                      <td className="py-3 pr-4 font-medium text-stone-950">{lead.fullName}</td>
                      <td className="py-3 pr-4 text-stone-700">{lead.preferredArea}</td>
                      <td className="py-3 pr-4 text-stone-700">{formatAed(lead.budgetAed)}</td>
                      <td className="py-3 pr-4"><Badge tone={lead.temperature}>{lead.score} {lead.temperature}</Badge></td>
                      <td className="py-3 pr-4 text-stone-700">{lead.stage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-950">{value}</p>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-stone-300 text-sm text-stone-500">{text}</div>;
}
