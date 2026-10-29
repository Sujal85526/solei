import "server-only";
import { isUuid } from "@/lib/ids";
import { assertPermission } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { CampaignAudience, SegmentRules } from "./schema";

export type Segment = {
  id: string;
  name: string;
  description: string | null;
  rules: SegmentRules;
  updatedAt: string;
};

export type SegmentMember = {
  customerId: string;
  name: string | null;
  email: string | null;
  totalSpentFils: number;
  orderCount: number;
  lastPurchaseAt: string | null;
  hasPassport: boolean;
  emailable: boolean;
};

export type SegmentPreview = { total: number; emailable: number; sample: SegmentMember[] };

async function members(rules: SegmentRules): Promise<SegmentMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("segment_members", { p_rules: rules });
  if (error) throw new Error(error.message);
  return data.map((m) => ({
    customerId: m.customer_id,
    name: m.name,
    email: m.email,
    totalSpentFils: m.total_spent_fils,
    orderCount: m.order_count,
    lastPurchaseAt: m.last_purchase_at,
    hasPassport: m.has_passport,
    emailable: m.emailable,
  }));
}

/** How many customers match, how many can be emailed, and the first few (biggest spenders). */
export async function previewSegment(rules: SegmentRules, sampleSize = 8): Promise<SegmentPreview> {
  await assertPermission("marketing.manage");
  const all = await members(rules);
  return {
    total: all.length,
    emailable: all.filter((m) => m.emailable).length,
    sample: all.slice(0, sampleSize),
  };
}

export async function listSegments(): Promise<(Segment & { total: number; emailable: number })[]> {
  await assertPermission("marketing.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_segments")
    .select("id, name, description, rules, updated_at")
    .order("name");
  if (error) throw new Error(error.message);
  // A boutique's customer list is small; count each segment live.
  return Promise.all(
    data.map(async (s) => {
      const m = await members(s.rules as SegmentRules);
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        rules: s.rules as SegmentRules,
        updatedAt: s.updated_at,
        total: m.length,
        emailable: m.filter((x) => x.emailable).length,
      };
    }),
  );
}

export async function getSegment(id: string): Promise<Segment | null> {
  await assertPermission("marketing.manage");
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_segments")
    .select("id, name, description, rules, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data
    ? {
        id: data.id,
        name: data.name,
        description: data.description,
        rules: data.rules as SegmentRules,
        updatedAt: data.updated_at,
      }
    : null;
}

/** Customers a campaign to this segment would reach (email opt-ins). */
export async function emailableMembers(rules: SegmentRules): Promise<SegmentMember[]> {
  return (await members(rules)).filter((m) => m.emailable && m.email);
}

export type CampaignCounts = { pending: number; sent: number; failed: number; skipped: number };

export type Campaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  segmentId: string | null;
  segmentName: string | null;
  audience: CampaignAudience;
  eventId: string | null;
  status: "draft" | "sending" | "sent";
  sentAt: string | null;
  updatedAt: string;
  counts: CampaignCounts;
};

const emptyCounts = (): CampaignCounts => ({ pending: 0, sent: 0, failed: 0, skipped: 0 });

type CampaignRow = {
  id: string;
  name: string;
  subject: string;
  body: string;
  segment_id: string | null;
  segment_name: string | null;
  audience: string;
  event_id: string | null;
  status: "draft" | "sending" | "sent";
  sent_at: string | null;
  updated_at: string;
  campaign_recipients: { status: keyof CampaignCounts }[];
};

const toCampaign = (r: CampaignRow): Campaign => ({
  id: r.id,
  name: r.name,
  subject: r.subject,
  body: r.body,
  segmentId: r.segment_id,
  segmentName: r.segment_name,
  audience: r.audience === "event_news" ? "event_news" : "segment",
  eventId: r.event_id,
  status: r.status,
  sentAt: r.sent_at,
  updatedAt: r.updated_at,
  counts: r.campaign_recipients.reduce(
    (c, x) => ({ ...c, [x.status]: c[x.status] + 1 }),
    emptyCounts(),
  ),
});

const CAMPAIGN_COLUMNS =
  "id, name, subject, body, segment_id, segment_name, audience, event_id, status, sent_at, updated_at, campaign_recipients(status)";

export async function listCampaigns(): Promise<Campaign[]> {
  await assertPermission("marketing.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data as unknown as CampaignRow[]).map(toCampaign);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  await assertPermission("marketing.manage");
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCampaign(data as unknown as CampaignRow) : null;
}

export type CampaignRecipient = {
  email: string;
  status: keyof CampaignCounts;
  error: string | null;
  sentAt: string | null;
  customerId: string | null;
};

export async function campaignRecipients(id: string): Promise<CampaignRecipient[]> {
  await assertPermission("marketing.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_recipients")
    .select("email, status, error, sent_at, customer_id")
    .eq("campaign_id", id)
    .order("id")
    .limit(1000);
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    email: r.email,
    status: r.status,
    error: r.error,
    sentAt: r.sent_at,
    customerId: r.customer_id,
  }));
}

/** Destinations for the segment form. */
export async function destinationOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("destinations").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Customers who asked for event news and can be emailed (an email, event news on). Read with the
 * service role after the permission check: it isn't a segment rule, so segment_members can't.
 */
export async function eventNewsMembers(): Promise<
  { customerId: string; email: string; name: string | null }[]
> {
  await assertPermission("marketing.manage");
  const { data, error } = await createAdminClient()
    .from("customers")
    .select("id, email, name")
    .eq("event_news", true)
    .not("email", "is", null)
    .order("created_at")
    .limit(20_000);
  if (error) throw new Error(error.message);
  return data.flatMap((c) => (c.email ? [{ customerId: c.id, email: c.email, name: c.name }] : []));
}
