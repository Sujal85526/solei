import "server-only";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { contactSchema } from "./schema";

/** Save the public contact details (audited by the `settings` trigger). */
export async function saveContactDetails(input: unknown) {
  const staff = await assertPermission("settings.manage");
  const v = contactSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      contact_email: v.contactEmail,
      whatsapp_number: v.whatsappNumber,
      instagram_handle: v.instagramHandle,
      instagram_url: v.instagramUrl,
      updated_by: staff.userId,
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}
