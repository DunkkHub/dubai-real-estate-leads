import Link from "next/link";
import type { ReactNode } from "react";
import { Download, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { addFollowUpAction, addNoteAction, completeFollowUpAction, deleteLeadAction, withdrawConsentAction } from "@/app/actions/crm";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatAed, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeadDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: true,
      consentRecords: { orderBy: { createdAt: "desc" } },
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      followUps: { include: { assignedTo: true }, orderBy: { dueDate: "asc" } },
      auditLogs: { include: { actor: true }, orderBy: { createdAt: "desc" } },
      opportunity: true,
    },
  });
  if (!lead) notFound();

  const latestConsent = lead.consentRecords[0];

  return (
    <AppShell userName={user.name}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <Link href="/leads" className="text-sm text-stone-600 underline">Back to leads</Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">{lead.fullName}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={lead.temperature}>{lead.score} {lead.temperature}</Badge>
              <Badge tone={lead.consentStatus === "ACTIVE" ? "active" : "withdrawn"}>{lead.consentStatus}</Badge>
              <Badge>{lead.stage}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className={buttonClassName("secondary")} href={`/api/leads/${lead.id}/export`}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </a>
            <form action={withdrawConsentAction}>
              <input type="hidden" name="leadId" value={lead.id} />
              <SubmitButton variant="secondary" pendingText="Withdrawing...">Withdraw consent</SubmitButton>
            </form>
            <form action={deleteLeadAction}>
              <input type="hidden" name="leadId" value={lead.id} />
              <SubmitButton variant="danger" pendingText="Deleting...">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete lead
              </SubmitButton>
            </form>
          </div>
        </div>

        <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lead profile</CardTitle>
                <CardDescription>Contact is allowed only while consent is active and within configured contact windows.</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 md:grid-cols-2">
                  <Info label="Email" value={lead.email || "Not provided"} />
                  <Info label="Phone" value={lead.phone || "Not provided"} />
                  <Info label="WhatsApp" value={lead.whatsapp || "Not provided"} />
                  <Info label="Budget" value={formatAed(lead.budgetAed)} />
                  <Info label="Transaction" value={lead.transactionType} />
                  <Info label="Property type" value={lead.propertyType} />
                  <Info label="Preferred area" value={lead.preferredArea} />
                  <Info label="Purpose" value={lead.purpose} />
                  <Info label="Timeline" value={lead.timeline} />
                  <Info label="Mortgage" value={lead.wantsMortgage ? "Yes" : "No"} />
                  <Info label="Source" value={lead.source} />
                  <Info label="Owner" value={lead.assignedTo?.name || "Unassigned"} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form action={addNoteAction} className="space-y-3">
                  <input type="hidden" name="leadId" value={lead.id} />
                  <Field label="Add note"><Textarea name="body" required /></Field>
                  <SubmitButton pendingText="Adding...">Add note</SubmitButton>
                </form>
                <div className="space-y-3">
                  {lead.notes.map((note) => (
                    <div key={note.id} className="rounded-md border border-stone-200 p-3">
                      <p className="text-sm leading-6 text-stone-800">{note.body}</p>
                      <p className="mt-2 text-xs text-stone-500">{note.author?.name || "Unknown"} · {formatDate(note.createdAt)}</p>
                    </div>
                  ))}
                  {lead.notes.length === 0 ? <p className="text-sm text-stone-500">No notes yet.</p> : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Consent proof</CardTitle>
                <CardDescription>Stored exact text, channel, timestamp, source, IP, and user agent where available.</CardDescription>
              </CardHeader>
              <CardContent>
                {latestConsent ? (
                  <dl className="space-y-3 text-sm">
                    <Info label="Consent text" value={latestConsent.consentText} />
                    <Info label="Channel" value={latestConsent.consentChannel} />
                    <Info label="Timestamp" value={formatDate(latestConsent.consentTimestamp)} />
                    <Info label="Source URL" value={latestConsent.consentSourceUrl || "Not provided"} />
                    <Info label="IP address" value={latestConsent.ipAddress || "Not captured"} />
                    <Info label="User agent" value={latestConsent.userAgent || "Not captured"} />
                    <Info label="Email contact" value={latestConsent.canContactEmail ? "Allowed" : "Not allowed"} />
                    <Info label="Phone contact" value={latestConsent.canContactPhone ? "Allowed" : "Not allowed"} />
                    <Info label="WhatsApp contact" value={latestConsent.canContactWhatsapp ? "Allowed" : "Not allowed"} />
                    <Info label="Withdrawn" value={formatDate(latestConsent.withdrawnAt)} />
                  </dl>
                ) : (
                  <p className="text-sm text-red-700">No consent record found. This should be investigated.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Follow-ups</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form action={addFollowUpAction} className="space-y-3">
                  <input type="hidden" name="leadId" value={lead.id} />
                  <Field label="Task"><Input name="title" required /></Field>
                  <Field label="Due date"><Input name="dueDate" type="datetime-local" required /></Field>
                  <SubmitButton pendingText="Adding...">Add follow-up</SubmitButton>
                </form>
                <div className="space-y-2">
                  {lead.followUps.map((task) => (
                    <div key={task.id} className="rounded-md border border-stone-200 p-3">
                      <p className="text-sm font-medium text-stone-900">{task.title}</p>
                      <p className="mt-1 text-xs text-stone-500">Due {formatDate(task.dueDate)}</p>
                      {task.completedAt ? (
                        <Badge tone="active" className="mt-2">Completed</Badge>
                      ) : (
                        <form action={completeFollowUpAction} className="mt-2">
                          <input type="hidden" name="id" value={task.id} />
                          <input type="hidden" name="leadId" value={lead.id} />
                          <SubmitButton variant="secondary" size="sm">Complete</SubmitButton>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lead.auditLogs.map((log) => (
                    <div key={log.id} className="border-l-2 border-stone-200 pl-3">
                      <p className="text-sm font-medium text-stone-900">{log.action}</p>
                      <p className="text-xs text-stone-500">{formatDate(log.createdAt)} · {log.actor?.name || "System"}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-stone-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-stone-900">{value}</dd>
    </div>
  );
}
