import { describe, expect, it } from "vitest";
import { inviteStaffSchema, roleKeyFromName, rolePermissionsSchema } from "./schema";

describe("staff schema", () => {
  it("normalises invite input", () => {
    const r = inviteStaffSchema.parse({
      fullName: "  Aisha ",
      email: "Aisha@Solei.AE",
      roleId: "8d6f0a2e-3a1b-4c55-9e1f-1d2b3c4d5e6f",
      position: "",
    });
    expect(r.email).toBe("aisha@solei.ae");
    expect(r.fullName).toBe("Aisha");
    expect(r.position).toBeNull();
    expect(r.employmentStatus).toBe("full_time");
  });

  it("rejects unknown permission keys", () => {
    expect(
      rolePermissionsSchema.safeParse({
        roleId: "8d6f0a2e-3a1b-4c55-9e1f-1d2b3c4d5e6f",
        permissions: ["orders.view", "root.all"],
      }).success,
    ).toBe(false);
  });

  it("derives role keys", () => {
    expect(roleKeyFromName("Event Lead (Dubai)")).toBe("event_lead_dubai");
    expect(roleKeyFromName("2nd shift team 2")).toBe("nd_shift_team_2");
  });
});
