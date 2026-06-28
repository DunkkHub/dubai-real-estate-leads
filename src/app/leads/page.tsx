import Link from "next/link";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateLeadStageAction } from "@/app/actions/crm";
import { LeadStage } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatAed, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const stages = Object.values(LeadStage);

export default async function LeadsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const q = String(params.q ?? "");
  const stage = String(params.stage ?? "");
  const temperature = String(params.temperature ?? "");

  const leads = await prisma.lead.findMany({
    where: {
      consentStatus: "ACTIVE",
      stage: stage ? (stage as LeadStage) : undefined,
      temperature: temperature || undefined,
      OR: q
        ? [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { preferredArea: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: { assignedTo: true },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
  });

  const grouped = stages.map((item) => ({ stage: item, leads: leads.filter((lead) => lead.stage === item) }));

  return (
    <AppShell userName={user.name}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950">Leads</h1>
            <p className="mt-1 text-sm text-stone-600">CRM records only appear here after consent has been captured.</p>
          </div>
          <a className={buttonClassName("secondary")} href="/api/leads/export">
            <Download className="h-4 w-4" aria-hidden="true" />
            Export leads
          </a>
        </div>

        <Card>
          <CardContent className="p-4">
            <form className="grid gap-3 md:grid-cols-4">
              <Field label="Search"><Input name="q" defaultValue={q} placeholder="Name, email, area" /></Field>
              <Field label="Stage">
                <Select name="stage" defaultValue={stage}>
                  <option value="">All</option>
                  {stages.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </Field>
              <Field label="Temperature">
                <Select name="temperature" defaultValue={temperature}>
                  <option value="">All</option>
                  <option value="hot">Hot</option>
                  <option value="warm">Warm</option>
                  <option value="cold">Cold</option>
                </Select>
              </Field>
              <div className="flex items-end"><Button className="w-full">Filter</Button></div>
            </form>
          </CardContent>
        </Card>

        <section className="grid gap-3 lg:grid-cols-3 xl:grid-cols-7">
          {grouped.map((column) => (
            <div key={column.stage} className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-900">{column.stage}</h2>
                <Badge>{column.leads.length}</Badge>
              </div>
              <div className="space-y-2">
                {column.leads.slice(0, 5).map((lead) => (
                  <Link key={lead.id} href={`/leads/${lead.id}`} className="block rounded-md border border-stone-200 p-3 hover:bg-stone-50">
                    <p className="text-sm font-medium text-stone-950">{lead.fullName}</p>
                    <p className="mt-1 text-xs text-stone-600">{lead.preferredArea} · {formatAed(lead.budgetAed)}</p>
                    <div className="mt-2"><Badge tone={lead.temperature}>{lead.score} {lead.temperature}</Badge></div>
                  </Link>
                ))}
                {column.leads.length === 0 ? <p className="rounded-md border border-dashed border-stone-200 p-3 text-xs text-stone-500">No leads</p> : null}
              </div>
            </div>
          ))}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>CRM lead table</CardTitle>
            <CardDescription>{leads.length} active consented leads.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead className="text-left text-xs uppercase text-stone-500">
                  <tr className="border-b border-stone-200">
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Contact</th>
                    <th className="py-3 pr-4">Budget</th>
                    <th className="py-3 pr-4">Area</th>
                    <th className="py-3 pr-4">Purpose</th>
                    <th className="py-3 pr-4">Timeline</th>
                    <th className="py-3 pr-4">Score</th>
                    <th className="py-3 pr-4">Stage</th>
                    <th className="py-3 pr-4">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-stone-100">
                      <td className="py-3 pr-4"><Link className="font-medium text-emerald-800 underline" href={`/leads/${lead.id}`}>{lead.fullName}</Link></td>
                      <td className="py-3 pr-4 text-stone-700">{lead.email || lead.phone || lead.whatsapp}</td>
                      <td className="py-3 pr-4 text-stone-700">{formatAed(lead.budgetAed)}</td>
                      <td className="py-3 pr-4 text-stone-700">{lead.preferredArea}</td>
                      <td className="py-3 pr-4 text-stone-700">{lead.purpose}</td>
                      <td className="py-3 pr-4 text-stone-700">{lead.timeline}</td>
                      <td className="py-3 pr-4"><Badge tone={lead.temperature}>{lead.score} {lead.temperature}</Badge></td>
                      <td className="py-3 pr-4">
                        <form action={updateLeadStageAction} className="flex min-w-40 gap-2">
                          <input type="hidden" name="leadId" value={lead.id} />
                          <Select name="stage" defaultValue={lead.stage} aria-label="Lead stage">
                            {stages.map((item) => <option key={item} value={item}>{item}</option>)}
                          </Select>
                          <SubmitButton variant="secondary" size="sm">Save</SubmitButton>
                        </form>
                      </td>
                      <td className="py-3 pr-4 text-stone-700">{formatDate(lead.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leads.length === 0 ? <div className="p-8 text-center text-sm text-stone-600">No active consented leads match the filters.</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
