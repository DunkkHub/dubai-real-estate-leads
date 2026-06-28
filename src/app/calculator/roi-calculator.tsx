"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { LeadCaptureForm } from "@/components/forms/lead-capture-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { formatAed } from "@/lib/utils";

type Values = {
  propertyPrice: number;
  downPayment: number;
  expectedMonthlyRent: number;
  serviceCharges: number;
  mortgageRate: number;
  otherYearlyCosts: number;
};

export function RoiCalculator({ consentText }: { consentText: string }) {
  const [values, setValues] = useState<Values>({
    propertyPrice: 1_500_000,
    downPayment: 375_000,
    expectedMonthlyRent: 9_500,
    serviceCharges: 18_000,
    mortgageRate: 4.75,
    otherYearlyCosts: 8_000,
  });
  const [calculated, setCalculated] = useState(false);

  const result = useMemo(() => {
    const annualRent = values.expectedMonthlyRent * 12;
    const loanAmount = Math.max(values.propertyPrice - values.downPayment, 0);
    const estimatedAnnualInterest = loanAmount * (values.mortgageRate / 100);
    const grossYield = values.propertyPrice ? (annualRent / values.propertyPrice) * 100 : 0;
    const netIncome = annualRent - values.serviceCharges - values.otherYearlyCosts - estimatedAnnualInterest;
    const netYield = values.propertyPrice ? (netIncome / values.propertyPrice) * 100 : 0;
    const monthlyCashFlow = netIncome / 12;
    return { grossYield, netYield, monthlyCashFlow };
  }, [values]);

  function update(key: keyof Values, value: string) {
    setValues((current) => ({ ...current, [key]: Number(value) || 0 }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <Card>
        <CardHeader>
          <Calculator className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <CardTitle>Dubai property ROI calculator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Property price">
              <Input type="number" value={values.propertyPrice} onChange={(event) => update("propertyPrice", event.target.value)} />
            </Field>
            <Field label="Down payment">
              <Input type="number" value={values.downPayment} onChange={(event) => update("downPayment", event.target.value)} />
            </Field>
            <Field label="Expected monthly rent">
              <Input type="number" value={values.expectedMonthlyRent} onChange={(event) => update("expectedMonthlyRent", event.target.value)} />
            </Field>
            <Field label="Yearly service charges">
              <Input type="number" value={values.serviceCharges} onChange={(event) => update("serviceCharges", event.target.value)} />
            </Field>
            <Field label="Mortgage rate %">
              <Input type="number" step="0.01" value={values.mortgageRate} onChange={(event) => update("mortgageRate", event.target.value)} />
            </Field>
            <Field label="Other yearly costs">
              <Input type="number" value={values.otherYearlyCosts} onChange={(event) => update("otherYearlyCosts", event.target.value)} />
            </Field>
          </div>
          <Button className="mt-5" onClick={() => setCalculated(true)}>Calculate ROI</Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Estimate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Metric label="Gross yield" value={`${result.grossYield.toFixed(2)}%`} />
            <Metric label="Estimated net yield" value={`${result.netYield.toFixed(2)}%`} />
            <Metric label="Monthly cash flow" value={formatAed(Math.round(result.monthlyCashFlow))} />
            <p className="text-xs leading-5 text-stone-500">
              Estimate only. Confirm actual service charges, vacancy assumptions, financing costs, fees, and tax treatment with qualified advisors.
            </p>
          </CardContent>
        </Card>
        {calculated ? (
          <Card>
            <CardHeader>
              <CardTitle>Get a tailored area shortlist</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadCaptureForm consentText={consentText} source="calculator" compact />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200 p-3">
      <p className="text-xs font-medium uppercase text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-stone-950">{value}</p>
    </div>
  );
}
