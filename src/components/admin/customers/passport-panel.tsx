import { Stamp } from "lucide-react";
import { AdminSection } from "@/components/admin/section";

/**
 * Solei Passport on the customer profile.
 *
 * PLACEHOLDER until milestone 15 (`feat/loyalty-passport`): loyalty tables don't exist yet, so
 * this deliberately shows no numbers. M15 replaces the body with stamps per destination,
 * available rewards and passport issue status (loyalty.view), plus manual stamp adjustments
 * (loyalty.adjust) — keep the `customerId` prop as the only input.
 */
export function PassportPanel({ customerId }: { customerId: string }) {
  return (
    <AdminSection title="Solei Passport" className="border-dashed">
      <div
        className="flex items-start gap-3"
        data-customer-id={customerId}
        data-testid="passport-panel"
      >
        <span
          aria-hidden
          className="bg-pink text-burgundy flex size-10 shrink-0 items-center justify-center rounded-full"
        >
          <Stamp className="size-5" />
        </span>
        <div>
          <p className="font-medium">Passport launches soon</p>
          <p className="text-muted-foreground text-sm">
            Stamps, rewards and passport status will appear here once the loyalty programme goes
            live.
          </p>
        </div>
      </div>
    </AdminSection>
  );
}
