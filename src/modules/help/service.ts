import "server-only";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { helpTopicSchema } from "./schema";

/** Save a help topic (title, "last updated" label, body, published). Audited by trigger. */
export async function saveHelpTopic(input: unknown) {
  const staff = await assertPermission("settings.manage");
  const v = helpTopicSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("help_topics")
    .update({
      title: v.title,
      updated_label: v.updatedLabel,
      body: v.body,
      published: v.published,
      updated_by: staff.userId,
    })
    .eq("id", v.id);
  if (error) throw new Error(error.message);
}
