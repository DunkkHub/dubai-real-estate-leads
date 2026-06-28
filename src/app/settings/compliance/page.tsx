import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateComplianceAction } from "@/app/actions/crm";
import { requireUser } from "@/lib/auth/session";
import { getComplianceSettings } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export default async function ComplianceSettingsPage() {
  const user = await requireUser();
  const settings = await getComplianceSettings();

  return (
    <AppShell userName={user.name}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-950">Compliance settings</h1>
          <p className="mt-1 text-sm text-stone-600">Control the exact consent and privacy copy used by public forms and manual conversions.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Consent and privacy</CardTitle>
            <CardDescription>Consent text changes apply to future submissions. Existing consent records keep their original exact text.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateComplianceAction} className="grid gap-4">
              <Field label="Consent checkbox text">
                <Textarea name="consentText" defaultValue={settings.consentText} required />
              </Field>
              <Field label="Privacy policy text">
                <Textarea name="privacyPolicyText" defaultValue={settings.privacyPolicyText} className="min-h-48" required />
              </Field>
              <Field label="Unsubscribe text">
                <Textarea name="unsubscribeText" defaultValue={settings.unsubscribeText} required />
              </Field>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Allowed contact start hour">
                  <Input name="allowedContactStartHour" type="number" min="0" max="23" defaultValue={settings.allowedContactStartHour} />
                </Field>
                <Field label="Allowed contact end hour">
                  <Input name="allowedContactEndHour" type="number" min="0" max="23" defaultValue={settings.allowedContactEndHour} />
                </Field>
                <Field label="Data retention days">
                  <Input name="dataRetentionDays" type="number" min="30" max="3650" defaultValue={settings.dataRetentionDays} />
                </Field>
              </div>
              <SubmitButton pendingText="Saving...">Save compliance settings</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
