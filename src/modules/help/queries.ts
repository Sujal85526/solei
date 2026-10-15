import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { must } from "@/lib/supabase/must";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { CONTENT_TAGS } from "@/modules/content/queries";
import type { HelpTopic } from "./schema";

const COLUMNS = "id, slug, title, updated_label, body, sort, published, updated_at";

type Row = {
  id: string;
  slug: string;
  title: string;
  updated_label: string | null;
  body: string;
  sort: number;
  published: boolean;
  updated_at: string;
};
const toTopic = (r: Row): HelpTopic => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  updatedLabel: r.updated_label,
  body: r.body,
  sort: r.sort,
  published: r.published,
  updatedAt: r.updated_at,
});

/** Published topics for the Help page (cached; refreshed when the owner saves). */
export async function getHelpTopics(): Promise<HelpTopic[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.help);
  const rows = must(
    await createPublicClient()
      .from("help_topics")
      .select(COLUMNS)
      .eq("published", true)
      .order("sort"),
    "help_topics",
  );
  return rows.map(toTopic);
}

/** Every topic, for the admin editor (RLS: settings.manage). */
export async function listHelpTopicsForAdmin(): Promise<HelpTopic[]> {
  const supabase = await createClient();
  const rows = must(
    await supabase.from("help_topics").select(COLUMNS).order("sort"),
    "help_topics",
  );
  return rows.map(toTopic);
}

export async function getHelpTopicForAdmin(slug: string): Promise<HelpTopic | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("help_topics")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  return data ? toTopic(data) : null;
}
