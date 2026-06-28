"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { publicLeadSchema } from "@/lib/validators/lead";
import { DUBAI_AREAS } from "@/lib/constants";

type LeadFormValues = z.input<typeof publicLeadSchema>;

export function LeadCaptureForm({
  consentText,
  source = "landing",
  compact = false,
}: {
  consentText: string;
  source?: string;
  compact?: boolean;
}) {
  const [serverError, setServerError] = useState("");
  const [created, setCreated] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LeadFormValues>({
    resolver: zodResolver(publicLeadSchema),
    defaultValues: {
      transactionType: "BUY",
      propertyType: "Apartment",
      preferredArea: "Dubai Marina",
      purpose: "INVESTMENT",
      timeline: "3-6 months",
      wantsMortgage: false,
      consent: false,
      consentText,
      source,
      canContactEmail: false,
      canContactPhone: false,
      canContactWhatsapp: false,
    },
  });

  async function onSubmit(values: LeadFormValues) {
    setServerError("");
    setCreated(false);
    const response = await fetch("/api/public/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, source, sourceUrl: window.location.href }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setServerError(data.error || "Could not submit the form.");
      return;
    }
    setCreated(true);
    reset({ ...values, fullName: "", email: "", phone: "", whatsapp: "", consent: false });
  }

  if (created) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        <h2 className="mt-3 text-base font-semibold">Thanks, your enquiry was received.</h2>
        <p className="mt-1 text-sm">A consented CRM lead was created with your submitted contact preferences.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
      <Field label="Full name" error={errors.fullName?.message}>
        <Input {...register("fullName")} autoComplete="name" />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <Input {...register("email")} type="email" autoComplete="email" />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input {...register("phone")} type="tel" autoComplete="tel" />
      </Field>
      <Field label="WhatsApp" error={errors.whatsapp?.message}>
        <Input {...register("whatsapp")} type="tel" autoComplete="tel" />
      </Field>
      <Field label="Budget AED" error={errors.budgetAed?.message}>
        <Input {...register("budgetAed")} type="number" min="0" inputMode="numeric" />
      </Field>
      <Field label="Buy or rent" error={errors.transactionType?.message}>
        <Select {...register("transactionType")}>
          <option value="BUY">Buy</option>
          <option value="RENT">Rent</option>
        </Select>
      </Field>
      <Field label="Property type" error={errors.propertyType?.message}>
        <Select {...register("propertyType")}>
          <option>Apartment</option>
          <option>Villa</option>
          <option>Townhouse</option>
          <option>Penthouse</option>
          <option>Studio</option>
        </Select>
      </Field>
      <Field label="Preferred area" error={errors.preferredArea?.message}>
        <Select {...register("preferredArea")}>
          {DUBAI_AREAS.map((area) => <option key={area}>{area}</option>)}
        </Select>
      </Field>
      <Field label="Purpose" error={errors.purpose?.message}>
        <Select {...register("purpose")}>
          <option value="INVESTMENT">Investment</option>
          <option value="LIVING">Living</option>
          <option value="RELOCATION">Relocation</option>
          <option value="HOLIDAY_HOME">Holiday home</option>
        </Select>
      </Field>
      <Field label="Timeline" error={errors.timeline?.message}>
        <Select {...register("timeline")}>
          <option>0-3 months</option>
          <option>3-6 months</option>
          <option>6-12 months</option>
          <option>12+ months</option>
        </Select>
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm text-stone-800">
        <input type="checkbox" className="h-4 w-4" {...register("wantsMortgage")} />
        I want mortgage guidance
      </label>
      <div className={compact ? "" : "md:col-span-2"}>
        <Field label="Consent text">
          <Textarea readOnly {...register("consentText")} />
        </Field>
      </div>
      <div className={compact ? "space-y-3" : "space-y-3 md:col-span-2"}>
        <label className="flex items-start gap-3 rounded-md border border-stone-300 bg-white p-3 text-sm text-stone-800">
          <input type="checkbox" className="mt-1 h-4 w-4" {...register("consent")} />
          <span>{consentText}</span>
        </label>
        {errors.consent?.message ? <p className="text-sm text-red-700" role="alert">{String(errors.consent.message)}</p> : null}
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" {...register("canContactEmail")} /> Email contact</label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" {...register("canContactPhone")} /> Phone contact</label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" {...register("canContactWhatsapp")} /> WhatsApp contact</label>
        </div>
      </div>
      {serverError ? <p className={compact ? "text-sm text-red-700" : "text-sm text-red-700 md:col-span-2"} role="alert">{serverError}</p> : null}
      <div className={compact ? "" : "md:col-span-2"}>
        <Button disabled={isSubmitting} className="w-full sm:w-auto">{isSubmitting ? "Submitting..." : "Get my Dubai property match"}</Button>
      </div>
    </form>
  );
}
