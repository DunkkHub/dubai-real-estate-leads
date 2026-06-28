import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Calculator, MapPinned, ShieldCheck } from "lucide-react";
import { LeadCaptureForm } from "@/components/forms/lead-capture-form";
import { PublicNav } from "@/components/public-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { getComplianceSettings } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const compliance = await getComplianceSettings();

  return (
    <main className="bg-stone-100">
      <section className="relative min-h-[86dvh] overflow-hidden text-white">
        <PublicNav />
        <Image
          src="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1800&q=80"
          alt="Dubai skyline and waterfront towers"
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-stone-950/55" />
        <div className="relative z-10 mx-auto flex min-h-[86dvh] max-w-7xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 lg:pb-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-200">Dubai Property Investment & Area Match</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
              Dubai Property Investment & Area Match
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-100">
              Compare budget, areas, yield, service charges, and relocation fit before you speak with an advisor.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#lead-form" className={buttonClassName("default")}>
                Start area match <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link href="/calculator" className={buttonClassName("secondary", undefined, "bg-white/95")}>
                ROI calculator
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 lg:grid-cols-3">
        {[
          { title: "Area fit", icon: MapPinned, text: "Shortlist communities by commute, lifestyle, budget, and rental demand." },
          { title: "ROI checks", icon: Calculator, text: "Estimate gross yield, net yield, and monthly cash flow before enquiry." },
          { title: "Consent first", icon: ShieldCheck, text: "Your details become a CRM lead only when you opt in with explicit consent." },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <item.icon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-stone-600">{item.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section id="lead-form" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Get your Dubai property match</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadCaptureForm consentText={compliance.consentText} source="landing" />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
