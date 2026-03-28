import { NextResponse } from "next/server";

import { getHashCinemaServiceManifest } from "@/lib/server/hashcinema-service";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    service: getHashCinemaServiceManifest(),
  });
}
