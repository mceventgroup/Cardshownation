"use client";

import { useState } from "react";
import { triggerAutoImports } from "@/app/admin/imports/actions";

type RunResult = {
  sources: Array<{
    source: string;
    label: string;
    imported: number;
    enriched: number;
    skipped: number;
    errors: string[];
  }>;
  imported: number;
  enriched: number;
  skipped: number;
  errors: string[];
};

export function RunDatabasePullsButton({
  className = "",
  label = "Run database pulls",
  showSummary = false,
  sources = [],
  defaultSource = "all",
  onComplete,
  onError,
}: {
  className?: string;
  label?: string;
  showSummary?: boolean;
  sources?: Array<{
    key: string;
    label: string;
  }>;
  defaultSource?: string;
  onComplete?: (result: RunResult) => void;
  onError?: (message: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState(
    defaultSource === "all" || sources.some((source) => source.key === defaultSource)
      ? defaultSource
      : "all"
  );

  async function handleClick() {
    setRunning(true);
    setError(null);
    try {
      const data = (await triggerAutoImports(selectedSource)) as RunResult;
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
      {sources.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedSource}
            onChange={(event) => setSelectedSource(event.target.value)}
            disabled={running}
            className="min-w-[220px] rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
          >
            <option value="all">All sources</option>
            {sources.map((source) => (
              <option key={source.key} value={source.key}>
                {source.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleClick}
            disabled={running}
            className={className}
          >
            {running ? "Running pulls..." : label}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={running}
          className={className}
        >
          {running ? "Running pulls..." : label}
        </button>
      )}
      {showSummary && result && (
        <p className="text-xs text-slate-500">
          Imported {result.imported}, enriched {result.enriched}, skipped {result.skipped}, errors {result.errors.length}.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
