import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { sendDueCartReminders } from "@/modules/carts/service";

/**
 * Scheduler entry point for bag reminders (e.g. Vercel Cron, hourly). Needs
 * `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set it is off.
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sendDueCartReminders();
  return NextResponse.json(result);
}
