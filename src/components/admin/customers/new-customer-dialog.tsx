"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CustomerPicker, type CustomerOption } from "./customer-picker";

/** List-page entry point: find an existing customer first, create only if there's no match. */
export function NewCustomerDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const onSelect = useCallback(
    (c: CustomerOption) => {
      setOpen(false);
      router.push(`/admin/customers/${c.id}`);
    },
    [router],
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlus /> New customer
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Find or add a customer</DialogTitle>
          <DialogDescription>
            Search by phone first — every customer is kept once per phone number.
          </DialogDescription>
        </DialogHeader>
        <CustomerPicker onSelect={onSelect} source="manual" welcome autoFocus />
      </DialogContent>
    </Dialog>
  );
}
