import { getReport } from "@/lib/jobs/repository";
import { generateReportPdf } from "@/lib/pdf/report";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_: NextRequest, context: Context) {
  const { jobId } = await context.params;
  const report = await getReport(jobId);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (report.downloadUrl) {
    return NextResponse.redirect(report.downloadUrl, 302);
  }

  const pdfBuffer = await generateReportPdf(report);
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="hashcinema-${jobId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
