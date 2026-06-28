import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportForm } from "@/app/imports/import-form";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const user = await requireUser();
  const jobs = await prisma.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  return (
    <AppShell userName={user.name}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-950">Imports</h1>
          <p className="mt-1 text-sm text-stone-600">CSV import supports public opportunities and consented leads. Lead rows must include consent source and date.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>Opportunity columns: sourceUrl, platform, publicTextSnippet. Lead columns additionally require consentTimestamp/consentDate and consentSourceUrl/consentSource.</CardDescription>
          </CardHeader>
          <CardContent>
            <ImportForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent imports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead className="text-left text-xs uppercase text-stone-500">
                  <tr className="border-b border-stone-200">
                    <th className="py-3 pr-4">File</th>
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Imported</th>
                    <th className="py-3 pr-4">Rejected</th>
                    <th className="py-3 pr-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b border-stone-100">
                      <td className="py-3 pr-4 font-medium text-stone-900">{job.filename}</td>
                      <td className="py-3 pr-4 text-stone-700">{job.type}</td>
                      <td className="py-3 pr-4"><Badge tone={job.status === "COMPLETED" ? "active" : "default"}>{job.status}</Badge></td>
                      <td className="py-3 pr-4 tabular-nums text-stone-700">{job.importedRows}</td>
                      <td className="py-3 pr-4 tabular-nums text-stone-700">{job.rejectedRows}</td>
                      <td className="py-3 pr-4 text-stone-700">{formatDate(job.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {jobs.length === 0 ? <div className="p-8 text-center text-sm text-stone-600">No import jobs yet.</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
