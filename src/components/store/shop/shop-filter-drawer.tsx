"use client";

import Link from "next/link";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { SideDrawer } from "@/components/store/side-drawer";
import { t } from "@/content/en";
import { FilterOptions, type FilterOption } from "./filter-options";

/** Phones: a filter icon that opens Filter & Sort in the baby-pink drawer from the right. */
export function ShopFilterDrawer({
  groups,
  filtered,
}: {
  groups: { label: string; options: FilterOption[] }[];
  filtered: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <SideDrawer
      open={open}
      onOpenChange={setOpen}
      side="end"
      trigger={{
        label: t.shop.filterAndSort,
        icon: (
          <span className="relative">
            <SlidersHorizontal className="size-[1.15rem]" strokeWidth={1.25} />
            {filtered ? (
              <span className="bg-primary absolute -end-1 -top-1 size-1.5 rounded-full" />
            ) : null}
          </span>
        ),
        className:
          "text-primary -me-2.5 flex size-11 items-center justify-center transition-opacity hover:opacity-70",
      }}
      title={t.shop.filterAndSort}
      closeLabel={t.shop.closeFilters}
    >
      <div className="mt-10 flex flex-col gap-9">
        {groups.map((g) => (
          <FilterOptions
            key={g.label}
            label={g.label}
            options={g.options}
            layout="stack"
            onSelect={close}
          />
        ))}
      </div>
      {filtered ? (
        <Link
          href="/shop"
          scroll={false}
          onClick={close}
          className="eyebrow text-primary mt-auto self-start border-b border-current pb-1 text-[0.6rem]"
        >
          {t.shop.clearFilters}
        </Link>
      ) : null}
    </SideDrawer>
  );
}
