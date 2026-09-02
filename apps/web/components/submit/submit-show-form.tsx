"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { startTransition, useActionState } from "react";

export type SubmitShowFormState = {
  code?: "blocked" | "duplicate" | "rate" | "validation";
  message?: string;
};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand-600 px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70 sm:w-auto">
      {pending ? "Submitting your show…" : "Submit show — free"}
    </button>
  );
}

export function SubmitShowForm({ action, initialState, children }: {
  action: (state: SubmitShowFormState, formData: FormData) => Promise<SubmitShowFormState>;
  initialState: SubmitShowFormState;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form
      action={formAction}
      data-analytics-event="submit_show_attempt"
      className="mt-8 space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {state.message && (
        <div role="alert" aria-live="polite" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          <p>{state.message}</p>
          {state.code === "duplicate" && <Link href="/card-shows" className="mt-1 inline-block font-semibold underline underline-offset-4">Search existing shows</Link>}
        </div>
      )}
      {children}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate-500">
            By submitting, you confirm these details may be published and agree to our <Link href="/terms" className="font-semibold text-brand-700 hover:underline">Terms</Link> and <Link href="/privacy" className="font-semibold text-brand-700 hover:underline">Privacy Policy</Link>.
          </p>
          <SubmitButton pending={pending} />
        </div>
      </div>
    </form>
  );
}
