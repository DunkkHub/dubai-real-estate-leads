import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { RoiCalculator } from "@/app/calculator/roi-calculator";
import { getComplianceSettings } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export default async function CalculatorPage() {
  const compliance = await getComplianceSettings();

  return (
    <main className="min-h-dvh bg-stone-100">
      <section className="relative bg-emerald-900 text-white">
        <PublicNav />
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-28 sm:px-6">
          <p className="text-sm font-semibold uppercase text-emerald-200">Dubai property ROI</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight">Estimate yield before you enquire</h1>
          <p className="mt-4 max-w-2xl text-stone-100">
            Compare rent, service charges, financing assumptions, and annual costs. Then opt in only if you want a tailored shortlist.
          </p>
          <Link href="/landing" className="mt-5 inline-flex text-sm font-medium text-white underline">Area match form</Link>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <RoiCalculator consentText={compliance.consentText} />
      </section>
    </main>
  );
}
