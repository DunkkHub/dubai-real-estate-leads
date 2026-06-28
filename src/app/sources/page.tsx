import { KeyRound, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { addKeywordAction, deleteKeywordAction, updateSourceEnabledAction } from "@/app/actions/crm";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const sourceDefinitions = [
  { platform: "Reddit", env: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USER_AGENT"] },
  { platform: "YouTube", env: ["YOUTUBE_API_KEY"] },
  { platform: "X", env: ["X_BEARER_TOKEN"] },
  { platform: "Meta", env: ["META_APP_ID", "META_APP_SECRET", "META_WEBHOOK_VERIFY_TOKEN"] },
  { platform: "LinkedIn", env: ["Manual CSV import only"] },
];

export default async function SourcesPage() {
  const user = await requireUser();
  const [configs, keywords] = await Promise.all([
    prisma.sourceConfig.findMany(),
    prisma.keywordConfig.findMany({ orderBy: [{ type: "asc" }, { value: "asc" }] }),
  ]);

  return (
    <AppShell userName={user.name}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-950">Sources</h1>
          <p className="mt-1 text-sm text-stone-600">Official API credentials are read from environment variables. Private contact data is never collected from profiles.</p>
        </div>

        <section className="grid gap-4 lg:grid-cols-2">
          {sourceDefinitions.map((source) => {
            const config = configs.find((item) => item.platform === source.platform);
            const missing = source.env.filter((key) => key.includes("_") && !process.env[key]);
            const configured = missing.length === 0 && !source.env[0].startsWith("Manual");
            const status = source.env[0].startsWith("Manual") ? "manual_import" : configured ? "configured" : "not_configured";
            return (
              <Card key={source.platform}>
                <CardHeader>
                  <KeyRound className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                  <CardTitle>{source.platform}</CardTitle>
                  <CardDescription>{source.env.join(", ")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={configured || status === "manual_import" ? "active" : "withdrawn"}>{status}</Badge>
                    {missing.map((item) => <Badge key={item}>{item} missing</Badge>)}
                  </div>
                  <form action={updateSourceEnabledAction} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 p-3">
                    <input type="hidden" name="platform" value={source.platform} />
                    <label className="flex min-h-11 items-center gap-2 text-sm text-stone-800">
                      <input type="checkbox" name="enabled" defaultChecked={config?.enabled ?? false} className="h-4 w-4" />
                      Enabled for monitoring
                    </label>
                    <SubmitButton variant="secondary" size="sm">Save</SubmitButton>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Keywords and target areas</CardTitle>
            <CardDescription>Used by source connectors, CSV normalization, and rule-based scoring.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form action={addKeywordAction} className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
              <Field label="Type">
                <Select name="type" defaultValue="TARGET">
                  <option value="TARGET">Target keyword</option>
                  <option value="EXCLUDED">Excluded keyword</option>
                  <option value="AREA">Dubai area</option>
                </Select>
              </Field>
              <Field label="Value"><Input name="value" placeholder="moving to Dubai" required /></Field>
              <div className="flex items-end">
                <SubmitButton>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add
                </SubmitButton>
              </div>
            </form>
            <div className="grid gap-4 lg:grid-cols-3">
              {(["TARGET", "EXCLUDED", "AREA"] as const).map((type) => (
                <div key={type} className="rounded-lg border border-stone-200 p-3">
                  <h2 className="text-sm font-semibold text-stone-900">{type}</h2>
                  <div className="mt-3 space-y-2">
                    {keywords.filter((item) => item.type === type).map((keyword) => (
                      <div key={keyword.id} className="flex items-center justify-between gap-2 rounded-md bg-stone-50 px-3 py-2">
                        <span className="text-sm text-stone-800">{keyword.value}</span>
                        <form action={deleteKeywordAction}>
                          <input type="hidden" name="id" value={keyword.id} />
                          <SubmitButton variant="ghost" size="icon" aria-label={`Delete ${keyword.value}`}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </SubmitButton>
                        </form>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
