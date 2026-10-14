import { Field } from "@/components/admin/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { employmentStatuses, employmentStatusLabels } from "@/modules/staff/schema";

export type RoleOption = { id: string; name: string };

export function StaffFormFields({
  roles,
  errors,
  defaults,
  includeEmail,
}: {
  roles: RoleOption[];
  errors: Record<string, string>;
  defaults?: {
    fullName?: string;
    roleId?: string;
    position?: string | null;
    phone?: string | null;
    employmentStatus?: string;
  };
  includeEmail?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" htmlFor="fullName" error={errors.fullName} required>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={defaults?.fullName}
          autoComplete="off"
          className="h-11"
        />
      </Field>
      {includeEmail ? (
        <Field
          label="Email"
          htmlFor="email"
          error={errors.email}
          required
          hint="They'll get an invitation to set a password."
        >
          <Input id="email" name="email" type="email" autoComplete="off" className="h-11" />
        </Field>
      ) : null}
      <Field label="Role" htmlFor="roleId" error={errors.roleId} required>
        <NativeSelect
          id="roleId"
          name="roleId"
          defaultValue={defaults?.roleId ?? ""}
          className="[&_select]:h-11"
        >
          <option value="" disabled>
            Choose a role
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Position" htmlFor="position" error={errors.position}>
        <Input
          id="position"
          name="position"
          defaultValue={defaults?.position ?? ""}
          placeholder="e.g. Event lead"
          className="h-11"
        />
      </Field>
      <Field label="Phone" htmlFor="phone" error={errors.phone}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaults?.phone ?? ""}
          placeholder="050 123 4567"
          className="h-11"
        />
      </Field>
      <Field label="Employment" htmlFor="employmentStatus" error={errors.employmentStatus}>
        <NativeSelect
          id="employmentStatus"
          name="employmentStatus"
          defaultValue={defaults?.employmentStatus ?? "full_time"}
          className="[&_select]:h-11"
        >
          {employmentStatuses.map((s) => (
            <option key={s} value={s}>
              {employmentStatusLabels[s]}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}
