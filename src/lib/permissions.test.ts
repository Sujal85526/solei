import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE_PERMISSIONS,
  FINANCIAL_PERMISSIONS,
  PERMISSION_KEYS,
  can,
} from "./permissions";

const migration = readFileSync(
  join(__dirname, "../../supabase/migrations/20261014000009_permissions_seed.sql"),
  "utf8",
);

describe("permissions", () => {
  it("every key in code exists in the database migration", () => {
    for (const key of PERMISSION_KEYS) expect(migration).toContain(`('${key}',`);
  });

  it("sales staff never get financial permissions by default", () => {
    const sales = DEFAULT_ROLE_PERMISSIONS.sales_staff as string[];
    for (const key of FINANCIAL_PERMISSIONS) expect(sales).not.toContain(key);
    expect(sales).toContain("pos.use");
  });

  it("managers can do everything except manage staff", () => {
    const manager = DEFAULT_ROLE_PERMISSIONS.manager as string[];
    expect(manager).not.toContain("staff.manage");
    expect(manager).toContain("reports.financial.view");
  });

  it("can() works with arrays, sets and 'all'", () => {
    expect(can(["orders.view"], "orders.view")).toBe(true);
    expect(can(new Set(["orders.view"]), "staff.manage")).toBe(false);
    expect(can("all", "staff.manage")).toBe(true);
  });
});
