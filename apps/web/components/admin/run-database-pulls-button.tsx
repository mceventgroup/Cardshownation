"use client";

import { useState } from "react";
import { triggerAutoImports } from "@/app/admin/imports/actions";

type RunResult = {
  sources: Array<{
    source: string;
    label: string;
    imported: number;
    skipped: number;
    errors: string[];
  }>;
  imported: number;
  skipped: number;
  errors: string[];
};

export function RunDatabasePullsButton({
  className = "",
  label = "Run database pulls",
  showSummary = false,
  onComplete,
  onError,
}: {
  className?: string;
  label?: string;
  showSummary?: boolean;
  onComplete?: (result: RunResult) => void;
  onError?: (message: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setError(null);
    try {
      const data = (await triggerAutoImports()) as RunResult;
      setResult(data);
      onComplete?.(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      onError?.(message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={running}
        className={className}
      >
        {running ? "Running pulls..." : label}
      </button>
      {showSummary && result && (
        <p className="text-xs text-slate-500">
          Imported {result.imported}, skipped {result.skipped}, errors {result.errors.length}.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
