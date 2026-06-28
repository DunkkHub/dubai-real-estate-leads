"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";

export function ImportForm() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/imports", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    const data = (await response.json()) as { ok: boolean; imported?: number; rejectedRows?: number; error?: string };
    setLoading(false);
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Import failed.");
      return;
    }
    setMessage(`Imported ${data.imported} rows. Rejected ${data.rejectedRows} rows.`);
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-[220px_1fr_auto]">
      <Field label="Import type">
        <Select name="type" defaultValue="OPPORTUNITIES">
          <option value="OPPORTUNITIES">Opportunities</option>
          <option value="LEADS">Consented leads</option>
        </Select>
      </Field>
      <Field label="CSV file">
        <input
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        />
      </Field>
      <div className="flex items-end">
        <Button disabled={loading} className="w-full">
          <Upload className="h-4 w-4" aria-hidden="true" />
          {loading ? "Importing..." : "Import"}
        </Button>
      </div>
      {message ? <p className="text-sm text-stone-700 md:col-span-3" role="status">{message}</p> : null}
    </form>
  );
}
