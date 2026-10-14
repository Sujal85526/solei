import { describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "@/providers/email/types";
import { createNotifier, type LogRow, type NotifierDeps, type TemplateRow } from "./notifier";

function setup(
  opts: {
    template?: TemplateRow | null;
    allowed?: boolean;
    sendError?: Error;
    sentRecently?: boolean;
    logError?: Error;
  } = {},
) {
  const logs: LogRow[] = [];
  const sent: EmailMessage[] = [];
  const sentSince = vi.fn(async () => opts.sentRecently ?? false);
  const deps: NotifierDeps = {
    loadTemplate: async () =>
      opts.template === undefined
        ? { subject: "Order {{n}}", body: "Hi {{name}}", enabled: true }
        : opts.template,
    sentSince,
    writeLog: async (row) => {
      if (opts.logError) throw opts.logError;
      logs.push(row);
    },
    provider: () => ({
      name: "fake",
      send: async (m) => {
        if (opts.sendError) throw opts.sendError;
        sent.push(m);
        return { id: "msg_1" };
      },
    }),
    recipientAllowed: () => opts.allowed ?? true,
    now: () => new Date("2026-10-14T10:00:00Z"),
  };
  return { notify: createNotifier(deps), logs, sent, sentSince };
}

const input = { to: "Layla@Example.com", vars: { n: "SOL-001001", name: "Layla" }, orderId: "o1" };

describe("notifier", () => {
  it("renders, sends and logs a sent email", async () => {
    const { notify, logs, sent } = setup();
    expect(await notify("order_confirmation", input)).toEqual({ status: "sent" });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("layla@example.com");
    expect(sent[0].subject).toBe("Order SOL-001001");
    expect(sent[0].html).toContain("Hi Layla");
    expect(logs).toEqual([
      expect.objectContaining({
        template_key: "order_confirmation",
        status: "sent",
        provider: "fake",
        provider_id: "msg_1",
        order_id: "o1",
        subject: "Order SOL-001001",
      }),
    ]);
  });

  it("skips and logs disabled templates without sending", async () => {
    const { notify, logs, sent } = setup({
      template: { subject: "S", body: "B", enabled: false },
    });
    expect(await notify("order_preparing", input)).toMatchObject({ status: "skipped" });
    expect(sent).toHaveLength(0);
    expect(logs[0]).toMatchObject({ status: "skipped", error: "Template disabled" });
  });

  it("skips recipients outside the allowlist", async () => {
    const { notify, logs, sent } = setup({ allowed: false });
    expect((await notify("order_confirmation", input)).status).toBe("skipped");
    expect(sent).toHaveLength(0);
    expect(logs[0]).toMatchObject({
      status: "skipped",
      error: expect.stringMatching(/allowlist/),
      subject: "Order SOL-001001",
    });
  });

  it("skips when there is no address", async () => {
    const { notify, logs } = setup();
    expect((await notify("order_confirmation", { ...input, to: null })).status).toBe("skipped");
    expect(logs[0]).toMatchObject({ status: "skipped", recipient: "—" });
  });

  it("logs provider failures and never throws", async () => {
    const { notify, logs } = setup({ sendError: new Error("Resend: rate limited") });
    const r = await notify("order_confirmation", input);
    expect(r).toEqual({ status: "failed", reason: "Resend: rate limited" });
    expect(logs[0]).toMatchObject({
      status: "failed",
      error: "Resend: rate limited",
      provider: "fake",
    });
  });

  it("survives a failing log write", async () => {
    const { notify } = setup({ logError: new Error("db down") });
    await expect(notify("order_confirmation", input)).resolves.toEqual({ status: "sent" });
  });

  it("suppresses repeats with the same dedupe key inside the window", async () => {
    const { notify, sent, sentSince, logs } = setup({ sentRecently: true });
    const r = await notify("owner_low_stock", { ...input, dedupeKey: "SKU-1" });
    expect(r.status).toBe("skipped");
    expect(sent).toHaveLength(0);
    expect(logs).toHaveLength(0);
    expect(sentSince).toHaveBeenCalledWith(
      "owner_low_stock",
      "SKU-1",
      new Date("2026-10-13T10:00:00Z"),
    );
  });

  it("sends when the dedupe key wasn't used recently", async () => {
    const { notify, logs } = setup({ sentRecently: false });
    expect((await notify("owner_low_stock", { ...input, dedupeKey: "SKU-1" })).status).toBe(
      "sent",
    );
    expect(logs[0].dedupe_key).toBe("SKU-1");
  });
});
