"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/** Show a toast whenever a new action result arrives; returns field errors for the form. */
export function useActionToast<T>(state: ActionResult<T> | null, onSuccess?: (data: T) => void) {
  const last = useRef<ActionResult<T> | null>(null);
  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      onSuccess?.(state.data);
    } else {
      toast.error(state.error);
    }
  }, [state, onSuccess]);
  return state && !state.ok ? (state.fieldErrors ?? {}) : {};
}
