import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getComplianceSettings } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const settings = await getComplianceSettings();

  return (
    <main className="min-h-dvh bg-stone-100">
      <section className="relative bg-emerald-900 text-white">
        <PublicNav />
        <div className="mx-auto max-w-4xl px-4 pb-12 pt-28 sm:px-6">
          <h1 className="text-4xl font-semibold">Privacy policy</h1>
          <p className="mt-3 text-stone-100">How this platform separates public opportunities from consented leads.</p>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Data handling</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-7 text-stone-800">{settings.privacyPolicyText}</p>
            <div className="mt-6 text-sm">
              <Link href="/landing" className="text-emerald-800 underline">Return to landing page</Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
