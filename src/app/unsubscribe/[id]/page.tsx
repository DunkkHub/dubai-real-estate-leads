import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { PublicNav } from "@/components/public-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { getComplianceSettings } from "@/lib/compliance";
import { withdrawLeadConsent } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function UnsubscribePage({ params }: PageProps) {
  const { id } = await params;
  const [settings, lead] = await Promise.all([
    getComplianceSettings(),
    prisma.lead.findUnique({ where: { id }, select: { id: true, fullName: true, consentStatus: true } }),
  ]);
  if (!lead) notFound();

  async function withdrawAction() {
    "use server";
    await withdrawLeadConsent(id, null);
    revalidatePath(`/unsubscribe/${id}`);
  }

  return (
    <main className="min-h-dvh bg-stone-100">
      <section className="relative bg-emerald-900 text-white">
        <PublicNav />
        <div className="mx-auto max-w-3xl px-4 pb-12 pt-28 sm:px-6">
          <h1 className="text-4xl font-semibold">Withdraw consent</h1>
          <p className="mt-3 text-stone-100">Stop non-transactional contact from this Dubai property enquiry.</p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>{lead.fullName}</CardTitle>
            <CardDescription>{settings.unsubscribeText}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge tone={lead.consentStatus === "ACTIVE" ? "active" : "withdrawn"}>{lead.consentStatus}</Badge>
            {lead.consentStatus === "ACTIVE" ? (
              <form action={withdrawAction}>
                <SubmitButton variant="danger" pendingText="Withdrawing...">Withdraw consent</SubmitButton>
              </form>
            ) : (
              <p className="text-sm text-stone-700">Consent has already been withdrawn.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
