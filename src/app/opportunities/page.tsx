import Link from "next/link";
import { ExternalLink, MessageSquarePlus, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { createOutreachTaskAction, convertOpportunityToLeadAction, markOpportunityNotRelevantAction } from "@/app/actions/crm";
import { requireUser } from "@/lib/auth/session";
import { getComplianceSettings } from "@/lib/compliance";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const source = String(params.source ?? "");
  const keyword = String(params.keyword ?? "");
  const area = String(params.area ?? "");
  const minScore = Number(params.minScore ?? 0);
  const error = typeof params.error === "string" ? params.error : "";
  const compliance = await getComplianceSettings();

  const opportunities = await prisma.opportunity.findMany({
    where: {
      platform: source ? { equals: source, mode: "insensitive" } : undefined,
      detectedArea: area ? { equals: area, mode: "insensitive" } : undefined,
      intentScore: minScore ? { gte: minScore } : undefined,
      OR: keyword
        ? [
            { publicTextSnippet: { contains: keyword, mode: "insensitive" } },
            { intentCategory: { contains: keyword, mode: "insensitive" } },
            { detectedKeywords: { has: keyword } },
          ]
        : undefined,
    },
    orderBy: [{ status: "asc" }, { intentScore: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const sources = await prisma.opportunity.groupBy({ by: ["platform"] });
  const areas = await prisma.opportunity.groupBy({ by: ["detectedArea"], where: { detectedArea: { not: null } } });

  return (
    <AppShell userName={user.name}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950">Opportunities</h1>
            <p className="mt-1 text-sm text-stone-600">Public intent signals. These are not CRM leads until consent is proven.</p>
          </div>
          <Link className={buttonClassName("secondary")} href="/imports">Import CSV</Link>
        </div>

        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

        <Card>
          <CardContent className="p-4">
            <form className="grid gap-3 md:grid-cols-5">
              <Field label="Source">
                <Select name="source" defaultValue={source}>
                  <option value="">All</option>
                  {sources.map((item) => <option key={item.platform}>{item.platform}</option>)}
                </Select>
              </Field>
              <Field label="Keyword">
                <Input name="keyword" defaultValue={keyword} placeholder="mortgage, JVC, ROI" />
              </Field>
              <Field label="Area">
                <Select name="area" defaultValue={area}>
                  <option value="">All</option>
                  {areas.map((item) => item.detectedArea ? <option key={item.detectedArea}>{item.detectedArea}</option> : null)}
                </Select>
              </Field>
              <Field label="Min score">
                <Input name="minScore" type="number" min="0" max="100" defaultValue={minScore || ""} />
              </Field>
              <div className="flex items-end">
                <Button className="w-full" type="submit">Filter</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Public opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            {opportunities.length === 0 ? (
              <div className="rounded-md border border-dashed border-stone-300 p-8 text-center text-sm text-stone-600">No opportunities match the current filters.</div>
            ) : (
              <div className="space-y-4">
                {opportunities.map((opportunity) => (
                  <article key={opportunity.id} className="rounded-lg border border-stone-200 bg-white p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="new">{opportunity.platform}</Badge>
                          <Badge tone={opportunity.intentScore >= 70 ? "hot" : opportunity.intentScore >= 40 ? "warm" : "cold"}>
                            {opportunity.intentScore}/100
                          </Badge>
                          <Badge>{opportunity.intentCategory}</Badge>
                          <span className="text-xs text-stone-500">{formatDate(opportunity.createdAt)}</span>
                        </div>
                        <p className="max-w-4xl text-sm leading-6 text-stone-800">{opportunity.publicTextSnippet}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-stone-600">
                          <span>Area: {opportunity.detectedArea || "Unknown"}</span>
                          <span>Keywords: {opportunity.detectedKeywords.join(", ") || "None"}</span>
                          <span>Status: {opportunity.status}</span>
                        </div>
                        <a className="inline-flex items-center gap-1 text-sm font-medium text-emerald-800 underline" href={opportunity.sourceUrl} target="_blank" rel="noreferrer">
                          Source URL <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        <form action={createOutreachTaskAction}>
                          <input type="hidden" name="opportunityId" value={opportunity.id} />
                          <SubmitButton size="sm" pendingText="Creating...">
                            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                            Create manual outreach task
                          </SubmitButton>
                        </form>
                        <form action={markOpportunityNotRelevantAction}>
                          <input type="hidden" name="opportunityId" value={opportunity.id} />
                          <SubmitButton variant="secondary" size="sm" pendingText="Marking...">
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                            Mark as not relevant
                          </SubmitButton>
                        </form>
                      </div>
                    </div>

                    <details className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-4">
                      <summary className="cursor-pointer text-sm font-medium text-stone-900">Convert to lead manually with consent proof</summary>
                      <form action={convertOpportunityToLeadAction} className="mt-4 grid gap-4 md:grid-cols-2">
                        <input type="hidden" name="opportunityId" value={opportunity.id} />
                        <input type="hidden" name="sourceUrl" value={opportunity.sourceUrl} />
                        <Field label="Full name"><Input name="fullName" required /></Field>
                        <Field label="Email"><Input name="email" type="email" /></Field>
                        <Field label="Phone"><Input name="phone" type="tel" /></Field>
                        <Field label="WhatsApp"><Input name="whatsapp" type="tel" /></Field>
                        <Field label="Budget AED"><Input name="budgetAed" type="number" min="0" /></Field>
                        <Field label="Buy or rent">
                          <Select name="transactionType" defaultValue="BUY"><option value="BUY">Buy</option><option value="RENT">Rent</option></Select>
                        </Field>
                        <Field label="Property type"><Input name="propertyType" defaultValue="Apartment" required /></Field>
                        <Field label="Preferred area"><Input name="preferredArea" defaultValue={opportunity.detectedArea || "Dubai Marina"} required /></Field>
                        <Field label="Purpose">
                          <Select name="purpose" defaultValue="INVESTMENT">
                            <option value="INVESTMENT">Investment</option>
                            <option value="LIVING">Living</option>
                            <option value="RELOCATION">Relocation</option>
                            <option value="HOLIDAY_HOME">Holiday home</option>
                          </Select>
                        </Field>
                        <Field label="Timeline">
                          <Select name="timeline" defaultValue="3-6 months">
                            <option>0-3 months</option><option>3-6 months</option><option>6-12 months</option><option>12+ months</option>
                          </Select>
                        </Field>
                        <label className="flex min-h-11 items-center gap-2 text-sm text-stone-800">
                          <input type="checkbox" name="wantsMortgage" className="h-4 w-4" /> Wants mortgage
                        </label>
                        <Field label="Consent channel"><Input name="consentChannel" placeholder="WhatsApp, email, signed form" required /></Field>
                        <Field label="Consent source URL"><Input name="consentSourceUrl" type="url" placeholder="https://..." /></Field>
                        <Field label="Consent timestamp"><Input name="consentTimestamp" type="datetime-local" required /></Field>
                        <div className="md:col-span-2">
                          <Field label="Exact consent text shown">
                            <Textarea name="consentText" defaultValue={compliance.consentText} required />
                          </Field>
                        </div>
                        <div className="grid gap-2 md:col-span-2 md:grid-cols-3">
                          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="canContactEmail" className="h-4 w-4" /> Email consent</label>
                          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="canContactPhone" className="h-4 w-4" /> Phone consent</label>
                          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="canContactWhatsapp" className="h-4 w-4" /> WhatsApp consent</label>
                        </div>
                        <div className="md:col-span-2">
                          <SubmitButton pendingText="Creating lead...">Create consented lead</SubmitButton>
                        </div>
                      </form>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
