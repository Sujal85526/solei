"use server";

import { recordOptIn, type OptInState } from "@/modules/marketing/service";

export async function optInAction(_prev: OptInState, formData: FormData): Promise<OptInState> {
  return recordOptIn({
    channel: formData.get("channel"),
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    consent: formData.get("consent") === "on",
  });
}
