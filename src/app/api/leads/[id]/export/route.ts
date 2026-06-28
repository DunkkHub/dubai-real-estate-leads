import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { authOptions } from "@/lib/auth/options";
import { exportLeadsCsv } from "@/lib/leads";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const csv = await exportLeadsCsv([id]);
  await auditLog({ actorId: session.user.id, action: "lead.exported", entityType: "Lead", entityId: id, leadId: id, metadata: { scope: "single" } });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lead-${id}.csv"`,
    },
  });
}
