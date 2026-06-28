import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { authOptions } from "@/lib/auth/options";
import { exportLeadsCsv } from "@/lib/leads";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const csv = await exportLeadsCsv();
  await auditLog({ actorId: session.user.id, action: "lead.exported", entityType: "Lead", metadata: { scope: "all" } });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dubai-leads.csv"`,
    },
  });
}
