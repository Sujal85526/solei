import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { sendDueFeedbackRequests } from "@/modules/automation/service";

/** Daily scheduler entry point for feedback requests after delivery (Bearer CRON_SECRET; off without it). */
export async function GET(request: NextRequest) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendDueFeedbackRequests());
}
