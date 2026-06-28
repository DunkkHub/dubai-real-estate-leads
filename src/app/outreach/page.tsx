import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateOutreachStatusAction } from "@/app/actions/crm";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const user = await requireUser();
  const tasks = await prisma.outreachTask.findMany({
    include: { opportunity: true, assignedTo: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  return (
    <AppShell userName={user.name}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-950">Manual outreach queue</h1>
          <p className="mt-1 text-sm text-stone-600">Suggested public replies only. The app has no automatic DM, auto-comment, or spam sending workflow.</p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4" aria-hidden="true" />
            <p>Review context before replying. Keep replies educational, non-pushy, and direct users to opt-in only if useful.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>{tasks.length} manual outreach tasks.</CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="rounded-md border border-dashed border-stone-300 p-8 text-center text-sm text-stone-600">
                No outreach tasks yet. Create one from an opportunity.
              </div>
            ) : (
              <div className="grid gap-4">
                {tasks.map((task) => (
                  <article key={task.id} className="rounded-lg border border-stone-200 p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{task.platform}</Badge>
                          <Badge tone={task.status === "CONVERTED" ? "active" : "default"}>{task.status}</Badge>
                          <span className="text-xs text-stone-500">Due {formatDate(task.dueDate)}</span>
                        </div>
                        <p className="max-w-4xl text-sm leading-6 text-stone-700">{task.opportunity.publicTextSnippet}</p>
                        <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
                          <p className="text-xs font-medium uppercase text-stone-500">Suggested public reply</p>
                          <p className="mt-2 text-sm leading-6 text-stone-900">{task.suggestedPublicReply}</p>
                        </div>
                        <Link className="inline-flex items-center gap-1 text-sm font-medium text-emerald-800 underline" href={task.opportunity.sourceUrl} target="_blank">
                          Open source <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                      <form action={updateOutreachStatusAction} className="flex min-w-56 items-end gap-2">
                        <input type="hidden" name="id" value={task.id} />
                        <Select name="status" defaultValue={task.status} aria-label="Update outreach status">
                          <option value="PENDING">Pending</option>
                          <option value="REPLIED">Replied</option>
                          <option value="IGNORED">Ignored</option>
                          <option value="CONVERTED">Converted</option>
                        </Select>
                        <SubmitButton variant="secondary" pendingText="Saving...">Save</SubmitButton>
                      </form>
                    </div>
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
