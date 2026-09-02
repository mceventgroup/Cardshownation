"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

function BulkActionButtons({ rowCount, selectedCount }: { rowCount: number; selectedCount: number }) {
  const { pending } = useFormStatus();

  return (
    <>
      <button
        name="bulkAction"
        value="approve"
        disabled={pending || selectedCount === 0}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Working…" : `Approve selected${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
      </button>
      <button
        name="bulkAction"
        value="approveAll"
        disabled={pending || rowCount === 0}
        onClick={(event) => {
          if (!window.confirm(`Approve all ${rowCount} pending submissions? Confirmed duplicates will be rejected.`)) {
            event.preventDefault();
          }
        }}
        className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Approve all pending ({rowCount})
      </button>
      <button
        name="bulkAction"
        value="reject"
        disabled={pending || selectedCount === 0}
        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Reject selected
      </button>
    </>
  );
}

export function BulkSubmissionForm({
  action,
  rowCount,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  rowCount: number;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedCount, setSelectedCount] = useState(0);

  function getCheckboxes() {
    return Array.from(
      formRef.current?.querySelectorAll<HTMLInputElement>('input[name="submissionIds"]') ?? []
    );
  }

  function refreshSelectedCount() {
    const selectedIds = new Set(
      getCheckboxes()
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value)
    );
    setSelectedCount(selectedIds.size);
  }

  function toggleAll(checked: boolean) {
    for (const checkbox of getCheckboxes()) {
      checkbox.checked = checked;
    }
    setSelectedCount(checked ? rowCount : 0);
  }

  return (
    <form ref={formRef} action={action} className="space-y-3" onChange={refreshSelectedCount}>
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 xl:flex-row xl:items-center">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={selectedCount === rowCount && rowCount > 0}
            onChange={(event) => toggleAll(event.currentTarget.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Select all ({rowCount})
        </label>
        <input
          name="bulkNotes"
          placeholder="Optional shared review note"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <BulkActionButtons rowCount={rowCount} selectedCount={selectedCount} />
      </div>
      {children}
    </form>
  );
}
