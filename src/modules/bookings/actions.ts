"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { BOOKING_CONFIG_TAG } from "./queries";
import type { ConfigKind } from "./schema";
import * as bookings from "./service";
import type { Estimate } from "./types";

const entries = (fd: FormData) => Object.fromEntries(fd.entries());

// ─── Public ─────────────────────────────────────────────────────────────────────────────────

export async function previewEstimateAction(input: unknown): Promise<ActionResult<Estimate>> {
  try {
    return ok(await bookings.previewEstimate(input));
  } catch (e) {
    return fail(e);
  }
}

export async function submitBookingAction(
  input: unknown,
): Promise<ActionResult<{ ref: string; estimatedTotalFils: number }>> {
  try {
    return ok(await bookings.submitBooking(input));
  } catch (e) {
    return fail(e);
  }
}

export async function acceptQuoteAction(token: string): Promise<ActionResult> {
  try {
    await bookings.acceptQuote(token);
    revalidatePath(`/events/quote/${token}`);
    return ok(undefined, "Quotation accepted.");
  } catch (e) {
    return fail(e);
  }
}

export async function payQuoteAction(
  token: string,
  kind: "deposit" | "balance",
): Promise<ActionResult<{ url: string }>> {
  try {
    return ok({ url: await bookings.startQuotePayment(token, kind) });
  } catch (e) {
    return fail(e);
  }
}

// ─── Admin ──────────────────────────────────────────────────────────────────────────────────

const refreshBooking = (id: string) => {
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
};

export async function changeStatusAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const input = entries(fd);
    await bookings.changeStatus(input);
    refreshBooking(String(input.bookingId));
    return ok(undefined, "Booking updated.");
  } catch (e) {
    return fail(e);
  }
}

export async function setStatusAction(
  bookingId: string,
  status: "in_review" | "completed",
): Promise<ActionResult> {
  try {
    await bookings.changeStatus({ bookingId, status });
    refreshBooking(bookingId);
    return ok(undefined, status === "in_review" ? "Marked in review." : "Marked completed.");
  } catch (e) {
    return fail(e);
  }
}

export async function confirmBookingAction(bookingId: string): Promise<ActionResult> {
  try {
    await bookings.confirmBooking(bookingId);
    refreshBooking(bookingId);
    return ok(undefined, "Booking confirmed — it's on the calendar.");
  } catch (e) {
    return fail(e);
  }
}

export async function sendQuoteAction(
  input: unknown,
): Promise<ActionResult<{ version: number; link: string; emailed: boolean }>> {
  try {
    const r = await bookings.sendQuote(input);
    refreshBooking((input as { bookingId: string }).bookingId);
    return ok(
      { version: r.version, link: r.link, emailed: r.emailed },
      `Quotation v${r.version} ${r.emailed ? "sent" : "saved"}.`,
    );
  } catch (e) {
    return fail(e);
  }
}

export async function addMessageAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ whatsappUrl: string | null }>> {
  try {
    const input = entries(fd);
    const r = await bookings.addMessage(input);
    refreshBooking(String(input.bookingId));
    const message =
      input.kind === "note"
        ? "Note added."
        : input.kind === "email"
          ? r.emailed
            ? "Email sent."
            : "Message logged (email sending isn't set up yet)."
          : "Opening WhatsApp…";
    return ok({ whatsappUrl: r.whatsappUrl }, message);
  } catch (e) {
    return fail(e);
  }
}

export async function createPaymentLinkAction(
  bookingId: string,
  kind: "deposit" | "balance",
): Promise<ActionResult<{ url: string; amountFils: number; whatsappUrl: string | null }>> {
  try {
    const r = await bookings.createPaymentLink({ bookingId, kind });
    refreshBooking(bookingId);
    return ok(r, "Payment link ready.");
  } catch (e) {
    return fail(e);
  }
}

// ─── Config ─────────────────────────────────────────────────────────────────────────────────

function refreshConfig() {
  updateTag(BOOKING_CONFIG_TAG);
  revalidatePath("/admin/bookings/settings");
}

export async function saveConfigAction(
  kind: ConfigKind,
  _: unknown,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await bookings.saveConfig(kind, entries(fd));
    refreshConfig();
    return ok(undefined, "Saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteConfigAction(kind: ConfigKind, id: string): Promise<ActionResult> {
  try {
    await bookings.deleteConfig(kind, id);
    refreshConfig();
    return ok(undefined, "Deleted.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveBookingSettingsAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await bookings.saveBookingSettings(entries(fd));
    refreshConfig();
    return ok(undefined, "Booking settings saved.");
  } catch (e) {
    return fail(e);
  }
}
