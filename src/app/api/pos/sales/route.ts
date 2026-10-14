import { NextResponse, type NextRequest } from "next/server";
import { resolveStaff } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { completeSale } from "@/modules/pos/service";

/**
 * POS sale endpoint used by the client queue (works for live sales and offline replays).
 * 200 = recorded (or already recorded); 422 = will never succeed (show to staff); 401/403 = sign in.
 */
export async function POST(request: NextRequest) {
  const gate = await resolveStaff();
  if (gate.status !== "ok")
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!can(gate.staff.permissions, "pos.use"))
    return NextResponse.json({ error: "No POS access." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const result = await completeSale(body);
  if (result.ok) return NextResponse.json(result);
  return NextResponse.json(result, { status: result.retryable ? 503 : 422 });
}
