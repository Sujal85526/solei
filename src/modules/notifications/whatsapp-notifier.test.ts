import { describe, expect, it, vi } from "vitest";
import { createWhatsAppNotifier, type WhatsAppNotifierDeps } from "./whatsapp-notifier";

function setup(over: Partial<WhatsAppNotifierDeps> = {}) {
  const sent: { to: string; body: string }[] = [];
  const logs: { status: string; error: string | null; channel: string }[] = [];
  const deps: WhatsAppNotifierDeps = {
    enabled: async () => true,
    loadTemplate: async () => ({
      subject: "Order {{order_number}}",
      body: "Hi {{customer_name}}, order {{order_number}} is on its way.",
      enabled: true,
    }),
    sentSince: async () => false,
    writeLog: async (row) => {
      logs.push({ status: row.status, error: row.error, channel: row.channel });
    },
    provider: () => ({
      name: "log",
      sendWhatsApp: async (m) => {
        sent.push(m);
        return { id: "wamid.1" };
      },
    }),
    ...over,
  };
  return { notify: createWhatsAppNotifier(deps), sent, logs };
}

const input = {
  to: "+971501234567",
  vars: { customer_name: "Layla", order_number: "SOL-000123" },
};

describe("WhatsApp notifier", () => {
  it("renders the template as plain text and logs it under whatsapp", async () => {
    const { notify, sent, logs } = setup();
    expect(await notify("order_dispatched_whatsapp", input)).toEqual({ status: "sent" });
    expect(sent).toEqual([
      { to: "+971501234567", body: "Hi Layla, order SOL-000123 is on its way." },
    ]);
    expect(logs).toEqual([{ status: "sent", error: null, channel: "whatsapp" }]);
  });

  it("does nothing (and logs nothing) while the owner has it off", async () => {
    const { notify, sent, logs } = setup({ enabled: async () => false });
    expect((await notify("x", input)).status).toBe("skipped");
    expect(sent).toHaveLength(0);
    expect(logs).toHaveLength(0);
  });

  it("skips without a valid mobile and when already sent", async () => {
    const a = setup();
    expect((await a.notify("x", { ...input, to: "0501234567" })).reason).toBe("No mobile number");
    const b = setup({ sentSince: async () => true });
    expect((await b.notify("x", { ...input, dedupeKey: "order:1" })).reason).toBe(
      "Already sent recently",
    );
    expect(b.sent).toHaveLength(0);
  });

  it("never throws: provider errors are logged as failed", async () => {
    const { notify, logs } = setup({
      provider: () => ({
        name: "broken",
        sendWhatsApp: vi.fn().mockRejectedValue(new Error("token expired")),
      }),
    });
    expect(await notify("x", input)).toEqual({ status: "failed", reason: "token expired" });
    expect(logs[0]).toMatchObject({ status: "failed", error: "token expired" });
  });
});
