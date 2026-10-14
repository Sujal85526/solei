"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Like useActionState, but the form is NOT reset after submitting (React 19 resets
 * `<form action>` forms after every submission — on a validation error that would wipe what
 * the user typed). Spread the returned props on the form: `<form {...formProps}>`.
 *
 * - `action` keeps progressive enhancement: before hydration the browser POSTs to the server
 *   action (never a GET that would put field values — e.g. passwords — in the URL).
 * - `onSubmit` takes over once hydrated and dispatches inside a transition, which skips the reset.
 */
export function useFormAction<S>(
  action: (prev: S, formData: FormData) => Promise<S>,
  initialState: S,
) {
  const [state, dispatch, pending] = useActionState<S, FormData>(
    action as (prev: Awaited<S>, formData: FormData) => Promise<S>,
    initialState as Awaited<S>,
  );
  const formProps = {
    action: dispatch,
    onSubmit: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      startTransition(() => dispatch(formData));
    },
  };
  return [state, formProps, pending] as const;
}
