import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { refreshOpenFulfilments } from "@/modules/fulfilments/service";

/** Scheduler: refresh every parcel still on its way (Bearer CRON_SECRET; off without it). */
export async function GET(request: NextRequest) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await refreshOpenFulfilments());
}
