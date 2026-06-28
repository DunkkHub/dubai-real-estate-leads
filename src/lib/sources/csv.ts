import Papa from "papaparse";
import { normalizePublicTextOpportunity } from "@/lib/sources/shared";
import type { NormalizedOpportunity } from "@/lib/sources/types";

export type CsvImportResult<T> = {
  rows: T[];
  rejected: Array<{ row: number; reason: string }>;
};

export type CsvLeadRow = {
  fullName: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  budgetAed?: number;
  transactionType: "BUY" | "RENT";
  propertyType: string;
  preferredArea: string;
  purpose: "INVESTMENT" | "LIVING" | "RELOCATION" | "HOLIDAY_HOME";
  timeline: string;
  source: string;
  consentText: string;
  consentSourceUrl?: string;
  consentTimestamp: Date;
  consentChannel: string;
};

export function parseCsv(text: string) {
  return Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  });
}

export function parseOpportunityCsv(text: string): CsvImportResult<NormalizedOpportunity> {
  const parsed = parseCsv(text);
  const rejected: CsvImportResult<NormalizedOpportunity>["rejected"] = [];
  const rows: NormalizedOpportunity[] = [];

  parsed.data.forEach((row, index) => {
    const sourceUrl = row.sourceUrl || row.url;
    const platform = row.platform || "CSV";
    const publicTextSnippet = row.publicTextSnippet || row.text || row.snippet;
    if (!sourceUrl || !publicTextSnippet) {
      rejected.push({ row: index + 2, reason: "sourceUrl and publicTextSnippet/text are required." });
      return;
    }

    rows.push(
      normalizePublicTextOpportunity({
        platform,
        sourceUrl,
        authorHandle: row.authorHandle || row.author || null,
        text: publicTextSnippet,
        language: row.language || "en",
      }),
    );
  });

  return { rows, rejected };
}

export function parseLeadCsv(text: string): CsvImportResult<CsvLeadRow> {
  const parsed = parseCsv(text);
  const rejected: CsvImportResult<CsvLeadRow>["rejected"] = [];
  const rows: CsvLeadRow[] = [];

  parsed.data.forEach((row, index) => {
    const consentTimestamp = row.consentTimestamp || row.consentDate;
    const consentSource = row.consentSourceUrl || row.consentSource || row.sourceUrl;
    if (!consentTimestamp || !consentSource) {
      rejected.push({ row: index + 2, reason: "Imported leads require consentTimestamp/consentDate and consentSourceUrl/consentSource." });
      return;
    }

    if (!row.fullName || (!row.email && !row.phone && !row.whatsapp)) {
      rejected.push({ row: index + 2, reason: "fullName and at least one contact method are required." });
      return;
    }

    rows.push({
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      whatsapp: row.whatsapp,
      budgetAed: row.budgetAed ? Number(row.budgetAed) : undefined,
      transactionType: (row.transactionType || "BUY").toUpperCase() === "RENT" ? "RENT" : "BUY",
      propertyType: row.propertyType || "Apartment",
      preferredArea: row.preferredArea || "Dubai Marina",
      purpose: normalizePurpose(row.purpose),
      timeline: row.timeline || "3-6 months",
      source: row.source || "CSV import",
      consentText: row.consentText || "Imported consent confirmed by source record supplied in CSV.",
      consentSourceUrl: consentSource,
      consentTimestamp: new Date(consentTimestamp),
      consentChannel: row.consentChannel || "CSV import",
    });
  });

  return { rows, rejected };
}

function normalizePurpose(value?: string): CsvLeadRow["purpose"] {
  const normalized = (value || "").toUpperCase().replaceAll(" ", "_");
  if (["INVESTMENT", "LIVING", "RELOCATION", "HOLIDAY_HOME"].includes(normalized)) {
    return normalized as CsvLeadRow["purpose"];
  }
  return "INVESTMENT";
}
