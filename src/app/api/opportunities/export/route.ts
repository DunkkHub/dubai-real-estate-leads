import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const opportunities = await prisma.opportunity.findMany({
    orderBy: [{ scrapedAt: "desc" }, { intentScore: "desc" }],
  });

  const csv = toCsv(
    opportunities.map((opportunity) => ({
      platform: opportunity.platform,
      sourceUrl: opportunity.sourceUrl,
      title: opportunity.title,
      publicTextSnippet: opportunity.publicTextSnippet,
      authorHandle: opportunity.authorHandle,
      detectedBudget: opportunity.detectedBudget,
      detectedArea: opportunity.detectedArea,
      detectedTimeline: opportunity.detectedTimeline,
      detectedPropertyType: opportunity.detectedPropertyType,
      intentCategory: opportunity.intentCategory,
      intentScore: opportunity.intentScore,
      status: opportunity.status,
      scrapedAt: opportunity.scrapedAt?.toISOString() ?? "",
    })),
  );

  await auditLog({ actorId: session.user.id, action: "opportunities.exported", entityType: "Opportunity", metadata: { count: opportunities.length } });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dubai-scraped-opportunities.csv"`,
    },
  });
}
