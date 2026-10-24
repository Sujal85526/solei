import "server-only";
import { serverEnv } from "@/lib/env.server";
import { MockCourierProvider } from "./mock";
import type { CourierProvider } from "./types";

export type { CourierProvider, ShipmentRequest, Tracking } from "./types";

let instance: CourierProvider | undefined;

/** The courier. Only the stand-in exists today (COURIER_PROVIDER unset or "mock"). */
export function courierProvider(): CourierProvider {
  if (instance) return instance;
  const name = serverEnv().COURIER_PROVIDER ?? "mock";
  if (name !== "mock") throw new Error(`Courier provider "${name}" isn't set up yet`);
  instance = new MockCourierProvider();
  return instance;
}
