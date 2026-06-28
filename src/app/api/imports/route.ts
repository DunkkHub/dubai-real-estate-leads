import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { auditLog } from "@/lib/audit";
import { createConsentedLead } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { saveOpportunities } from "@/lib/scraper/save";
import { parseLeadCsv, parseOpportunityCsv } from "@/lib/sources/csv";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const type = String(formData.get("type") || "OPPORTUNITIES").toUpperCase();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "CSV file is required." }, { status: 400 });
  }

  const text = await file.text();
  const job = await prisma.importJob.create({
    data: {
      type: type === "LEADS" ? "LEADS" : "OPPORTUNITIES",
      status: "PENDING",
      filename: file.name,
    },
  });

  if (type === "LEADS") {
    const parsed = parseLeadCsv(text);
    let imported = 0;
    const errors: string[] = [];
    for (const row of parsed.rows) {
      const result = await createConsentedLead({
        ...row,
        canContactEmail: Boolean(row.email),
        canContactPhone: Boolean(row.phone),
        canContactWhatsapp: Boolean(row.whatsapp),
        actorId: session.user.id,
      });
      if (result.ok) imported += 1;
      else errors.push(result.error);
    }

    const rejectedRows = parsed.rejected.length + errors.length;
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        totalRows: parsed.rows.length + parsed.rejected.length,
        importedRows: imported,
        rejectedRows,
        errorSummary: [...parsed.rejected.map((item) => `Row ${item.row}: ${item.reason}`), ...errors].join("\n").slice(0, 4000) || null,
      },
    });
    await auditLog({ actorId: session.user.id, action: "import.leads", entityType: "ImportJob", entityId: job.id, metadata: { imported, rejectedRows } });
    return NextResponse.json({ ok: true, imported, rejectedRows });
  }

  const parsed = parseOpportunityCsv(text);
  const imported = await saveOpportunities(parsed.rows);

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      totalRows: parsed.rows.length + parsed.rejected.length,
      importedRows: imported,
      rejectedRows: parsed.rejected.length,
      errorSummary: parsed.rejected.map((item) => `Row ${item.row}: ${item.reason}`).join("\n").slice(0, 4000) || null,
    },
  });
  await auditLog({ actorId: session.user.id, action: "import.opportunities", entityType: "ImportJob", entityId: job.id, metadata: { imported, rejectedRows: parsed.rejected.length } });
  return NextResponse.json({ ok: true, imported, rejectedRows: parsed.rejected.length });
}
