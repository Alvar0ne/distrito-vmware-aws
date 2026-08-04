import { NextResponse } from "next/server";
import { dbQuery, isPostgresEnabled } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    application: "ok",
    database: isPostgresEnabled() ? "checking" : "local",
    imageStorage: process.env.IMAGE_STORE === "s3" ? "s3" : "local"
  };

  try {
    if (isPostgresEnabled()) {
      await dbQuery("select 1");
      checks.database = "ok";
    }

    return NextResponse.json({
      status: "ok",
      checks,
      timestamp: new Date().toISOString()
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        checks: {
          ...checks,
          database: "error"
        },
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
