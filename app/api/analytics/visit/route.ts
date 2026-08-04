import { NextResponse } from "next/server";
import { z } from "zod";
import { recordVisit } from "@/lib/analyticsStore";

const visitSchema = z.object({
  path: z.string().min(1).max(300)
});

export async function POST(request: Request) {
  try {
    const input = visitSchema.parse(await request.json());
    await recordVisit({
      path: input.path,
      userAgent: request.headers.get("user-agent") ?? ""
    });
  } catch (error) {
    console.error("visit-track-error", error);
  }

  return NextResponse.json({ ok: true });
}
