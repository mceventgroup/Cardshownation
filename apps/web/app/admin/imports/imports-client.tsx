"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RunDatabasePullsButton } from "@/components/admin/run-database-pulls-button";
import type { PublicImportSource } from "@/lib/auto-import-sources";
import { createAutoImportSource, deleteAutoImportSource, updateAutoImportSource } from "./actions";

type SourceSummary = {
  key: string;
  label: string;
  type: string;
  scheduleLabel: string;
  url: string;
  origin: "database" | "environment";
  active: boolean;
  health: {
    status: "healthy" | "attention" | "stale" | "empty" | "never";
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    detected: number;
    imported: number;
    skipped: number;
    errors: number;
    message: string | null;
    statusNote: string | null;
    consecutiveEmptyRuns: number;
    recentRuns: Array<{ at: string; detected: number; imported: number; skipped: number; errors: number }>;
  } | null;
};

type RunSourceResult = {
  source: string;
  label: string;
  imported: number;
  enriched: number;
  skipped: number;
  errors: string[];
};

type RunResult = {
  sources: RunSourceResult[];
  imported: number;
  enriched: number;
  skipped: number;
  errors: string[];
};

type SourceData = {
  activeSources: SourceSummary[];
  managedSources: PublicImportSource[];
  environmentSources: PublicImportSource[];
};

type EditableSource = {
  name: string;
  url: string;
  city: string;
  state: string;
  organizerName: string;
  categories: string;
  facebookUrl: string;
  active: boolean;
};

function toEditableSource(source?: PublicImportSource): EditableSource {
  return {
    name: source?.name ?? "",
    url: source?.url ?? "",
    city: source?.city ?? "",
    state: source?.state ?? "",
    organizerName: source?.organizerName ?? "",
    categories: source?.categories?.join(", ") ?? "",
    facebookUrl: source?.facebookUrl ?? "",
    active: source?.active !== false,
  };
}

function formatRunDate(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  maxLength,
  className = "",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</span>
      {hint && <span className="mb-2 block text-xs leading-5 text-slate-500">{hint}</span>}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
      />
    </label>
  );
}

export function ImportsClient({ sources }: { sources: SourceData }) {
  const router = useRouter();
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newSource, setNewSource] = useState<EditableSource>(toEditableSource());
  const [editing, setEditing] = useState<Record<string, EditableSource>>(
    Object.fromEntries(
      sources.managedSources
        .filter((source) => source.id)
        .map((source) => [source.id as string, toEditableSource(source)])
    )
  );
  const scheduledSources = sources.activeSources.filter((source) => source.scheduleLabel !== "Manual only");
  const statusPriority: Record<NonNullable<SourceSummary["health"]>["status"], number> = {
    attention: 0, stale: 1, empty: 2, never: 3, healthy: 4,
  };
  const monitoredSources = [...scheduledSources].sort((left, right) =>
    statusPriority[left.health?.status ?? "never"] - statusPriority[right.health?.status ?? "never"]
  );
  const healthyCount = monitoredSources.filter((source) => source.health?.status === "healthy").length;
  const attentionCount = monitoredSources.filter((source) => source.health && !["healthy", "never"].includes(source.health.status)).length;
  const neverCount = monitoredSources.filter((source) => !source.health || source.health.status === "never").length;

  async function handleCreateSource() {
    setSavingId("new");
    setFormError(null);
    try {
      const response = await createAutoImportSource({
        ...newSource,
        categories: newSource.categories,
      });
      if (!response.ok) {
        setFormError(response.error ?? "Unable to add source.");
        return;
      }
      setNewSource(toEditableSource());
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  async function handleUpdateSource(id: string) {
    const source = editing[id];
    if (!source) return;

    setSavingId(id);
    setFormError(null);
    try {
      const response = await updateAutoImportSource(id, {
        ...source,
        categories: source.categories,
      });
      if (!response.ok) {
        setFormError(response.error ?? "Unable to save source.");
        return;
      }
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteSource(id: string) {
    setSavingId(id);
    setFormError(null);
    try {
      await deleteAutoImportSource(id);
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Auto-Import</h1>
          <p className="mt-1 text-sm text-slate-500">
            Runs automatically every Monday at 6 AM via Vercel Cron. Imported shows land in{" "}
            <Link href="/admin/submissions" className="font-medium text-brand-600 hover:underline">
              Submissions
            </Link>{" "}
            as Pending for review before publishing.
          </p>
        </div>
        <div className="flex w-full justify-start sm:w-auto sm:justify-end">
          <RunDatabasePullsButton
            label="Run database pulls"
            sources={sources.activeSources.map((source) => ({ key: source.key, label: source.label }))}
            onComplete={(data) => {
              setResult(data);
              setError(null);
            }}
            onError={(message) => {
              setError(message);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          />
        </div>
      </div>

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Source health</h2>
            <p className="mt-1 text-sm text-slate-500">The latest scan and most recent successful scan for every weekly source.</p>
          </div>
          <span className="text-xs text-slate-400">Updates after every automatic or manual run</span>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-2xl font-bold text-emerald-800">{healthyCount}</p><p className="mt-1 text-xs font-semibold text-emerald-700">Healthy sources</p></div>
          <div className={`rounded-2xl border p-4 ${attentionCount ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}><p className={`text-2xl font-bold ${attentionCount ? "text-red-800" : "text-slate-700"}`}>{attentionCount}</p><p className={`mt-1 text-xs font-semibold ${attentionCount ? "text-red-700" : "text-slate-500"}`}>Need attention</p></div>
          <div className={`rounded-2xl border p-4 ${neverCount ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}><p className={`text-2xl font-bold ${neverCount ? "text-amber-800" : "text-slate-700"}`}>{neverCount}</p><p className={`mt-1 text-xs font-semibold ${neverCount ? "text-amber-700" : "text-slate-500"}`}>Never scanned</p></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {monitoredSources.map((source) => {
            const health = source.health;
            const status = health?.status ?? "never";
            const statusClass = status === "healthy"
              ? "bg-emerald-50 text-emerald-700"
              : status === "attention"
                ? "bg-red-50 text-red-700"
                : status === "stale"
                  ? "bg-orange-50 text-orange-700"
                  : status === "empty"
                    ? "bg-amber-50 text-amber-800"
                : "bg-slate-100 text-slate-600";
            return (
              <article key={source.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{source.label}</h3>
                    <p className="mt-1 text-xs text-slate-500">{source.type}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                    {status === "healthy" ? "Healthy" : status === "attention" ? "Scan failed" : status === "stale" ? "Overdue" : status === "empty" ? "No listings found" : "Never run"}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-slate-400">Last run</dt><dd className="mt-1 font-medium text-slate-700">{formatRunDate(health?.lastRunAt ?? null)}</dd></div>
                  <div><dt className="text-slate-400">Last success</dt><dd className="mt-1 font-medium text-slate-700">{formatRunDate(health?.lastSuccessAt ?? null)}</dd></div>
                  <div><dt className="text-slate-400">Listings detected</dt><dd className="mt-1 text-base font-semibold text-blue-700">{health?.detected ?? 0}</dd></div>
                  <div><dt className="text-slate-400">New / existing</dt><dd className="mt-1 text-base font-semibold text-slate-700">{health?.imported ?? 0} / {health?.skipped ?? 0}</dd></div>
                </dl>
                {health?.statusNote && <p className={`mt-4 rounded-lg px-3 py-2 text-xs leading-5 ${status === "healthy" ? "bg-slate-50 text-slate-600" : "bg-amber-50 text-amber-900"}`}>{health.statusNote}</p>}
                {health?.message && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{health.message}</p>}
                {health?.recentRuns?.length ? <details className="mt-4 text-xs text-slate-500"><summary className="cursor-pointer font-semibold text-slate-600">Recent scan results</summary><ul className="mt-2 space-y-1">{health.recentRuns.map((run) => <li key={run.at}>{formatRunDate(run.at)} · {run.detected} detected · {run.errors ? `${run.errors} error${run.errors === 1 ? "" : "s"}` : `${run.imported} new`}</li>)}</ul></details> : null}
              </article>
            );
          })}
        </div>
      </section>

      <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Sources</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {sources.activeSources.map((source) => (
            <div key={source.key} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-slate-900">{source.label}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {source.type} import from public data only
                </p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-brand-600 hover:underline"
                >
                  {source.url}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {source.origin === "database" ? "Portal" : "Env/API"}
                </span>
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  Active
                </span>
                <span className="text-xs text-slate-400">{source.scheduleLabel}</span>
              </div>
            </div>
          ))}
          {sources.activeSources.length === 2 && (
            <div className="px-5 py-4 text-xs text-slate-500">
              Add <code className="rounded bg-slate-100 px-1">PUBLIC_SHOW_IMPORT_SOURCES_JSON</code>{" "}
              to import from public websites or public Facebook URLs.
            </div>
          )}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-800">Public-source limits</p>
        <p className="mt-1 text-sm text-amber-700">
          Website and Facebook imports only use public pages that can be fetched without logging in.
          Private groups, member-only content, and pages that render data only after client-side login
          will not import reliably.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Add a portal-managed source</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add one public website or Facebook page at a time. If the page does not clearly list city/state details, use the fallback fields below so imported shows still land in the right market.
          </p>
        </div>

        <div className="mb-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-3">
          <div>
            <p className="font-semibold text-slate-800">Best for</p>
            <p className="mt-1 text-xs leading-5">Promoter websites, public event pages, and public Facebook pages.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Avoid</p>
            <p className="mt-1 text-xs leading-5">Private groups, pages that need login, or feeds that render only after JavaScript app login.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Example URL</p>
            <p className="mt-1 text-xs leading-5">`https://examplepromotions.com/events`</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Source name"
            hint="Internal label for your team. Use the promoter or website name."
            value={newSource.name}
            onChange={(value) => setNewSource((current) => ({ ...current, name: value }))}
            placeholder="Example Promotions"
          />
          <Field
            label="Public URL"
            hint="The page the importer should scan for upcoming shows."
            value={newSource.url}
            onChange={(value) => setNewSource((current) => ({ ...current, url: value }))}
            placeholder="https://examplepromotions.com/events"
          />
          <Field
            label="Fallback city"
            hint="Used when the page does not clearly say which city the show is in."
            value={newSource.city}
            onChange={(value) => setNewSource((current) => ({ ...current, city: value }))}
            placeholder="Wichita"
          />
          <Field
            label="Fallback state"
            hint="Two-letter state code."
            value={newSource.state}
            onChange={(value) => setNewSource((current) => ({ ...current, state: value }))}
            placeholder="KS"
            maxLength={2}
          />
          <Field
            label="Organizer name"
            hint="Who should be credited if the page does not spell it out."
            value={newSource.organizerName}
            onChange={(value) => setNewSource((current) => ({ ...current, organizerName: value }))}
            placeholder="Example Promotions"
          />
          <Field
            label="Canonical Facebook URL"
            hint="Optional. Useful when the public page points back to Facebook."
            value={newSource.facebookUrl}
            onChange={(value) => setNewSource((current) => ({ ...current, facebookUrl: value }))}
            placeholder="https://facebook.com/examplepromotions"
          />
          <Field
            label="Categories"
            hint="Comma-separated. Example: Sports Cards, Pokemon, TCG"
            value={newSource.categories}
            onChange={(value) => setNewSource((current) => ({ ...current, categories: value }))}
            placeholder="Sports Cards, Pokemon"
            className="md:col-span-2"
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={newSource.active}
            onChange={(event) => setNewSource((current) => ({ ...current, active: event.target.checked }))}
          />
          Active
        </label>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleCreateSource}
            disabled={savingId === "new"}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingId === "new" ? "Saving..." : "Add source"}
          </button>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Portal sources</h2>
        {sources.managedSources.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No portal-managed sources yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {sources.managedSources.map((source) => {
              const id = source.id as string;
              const current = editing[id] ?? toEditableSource(source);
              return (
                <div key={id} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{source.name}</p>
                      <p className="text-xs text-slate-500">Edit the source details below.</p>
                    </div>
                    <a
                      href={current.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Open source page
                    </a>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Source name"
                      value={current.name}
                      onChange={(value) =>
                        setEditing((existing) => ({
                          ...existing,
                          [id]: { ...current, name: value },
                        }))
                      }
                    />
                    <Field
                      label="Public URL"
                      value={current.url}
                      onChange={(value) =>
                        setEditing((existing) => ({
                          ...existing,
                          [id]: { ...current, url: value },
                        }))
                      }
                    />
                    <Field
                      label="Fallback city"
                      value={current.city}
                      onChange={(value) =>
                        setEditing((existing) => ({
                          ...existing,
                          [id]: { ...current, city: value },
                        }))
                      }
                      placeholder="Fallback city"
                    />
                    <Field
                      label="Fallback state"
                      value={current.state}
                      onChange={(value) =>
                        setEditing((existing) => ({
                          ...existing,
                          [id]: { ...current, state: value },
                        }))
                      }
                      maxLength={2}
                      placeholder="KS"
                    />
                    <Field
                      label="Organizer name"
                      value={current.organizerName}
                      onChange={(value) =>
                        setEditing((existing) => ({
                          ...existing,
                          [id]: { ...current, organizerName: value },
                        }))
                      }
                      placeholder="Organizer name"
                    />
                    <Field
                      label="Canonical Facebook URL"
                      value={current.facebookUrl}
                      onChange={(value) =>
                        setEditing((existing) => ({
                          ...existing,
                          [id]: { ...current, facebookUrl: value },
                        }))
                      }
                      placeholder="Canonical Facebook URL"
                    />
                    <Field
                      label="Categories"
                      value={current.categories}
                      onChange={(value) =>
                        setEditing((existing) => ({
                          ...existing,
                          [id]: { ...current, categories: value },
                        }))
                      }
                      placeholder="Categories, comma-separated"
                      className="md:col-span-2"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={current.active}
                        onChange={(event) =>
                          setEditing((existing) => ({
                            ...existing,
                            [id]: { ...current, active: event.target.checked },
                          }))
                        }
                      />
                      Active
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleUpdateSource(id)}
                        disabled={savingId === id}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {savingId === id ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSource(id)}
                        disabled={savingId === id}
                        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {sources.environmentSources.length > 0 && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Environment Sources</h2>
          <p className="mt-1 text-sm text-slate-500">
            These still come from <code className="rounded bg-white px-1">PUBLIC_SHOW_IMPORT_SOURCES_JSON</code>.
            If the same URL exists in the portal, the portal version wins.
          </p>
          <div className="mt-4 space-y-2">
            {sources.environmentSources.map((source) => (
              <div key={source.url} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
                <div className="font-medium text-slate-900">{source.name}</div>
                <div className="text-slate-500">{source.url}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-4 text-sm font-semibold text-slate-700">Last run result</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{result.imported}</p>
              <p className="mt-1 text-xs text-green-600">New pending submissions</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{result.enriched}</p>
              <p className="mt-1 text-xs text-blue-600">Existing listings enriched</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <p className="text-2xl font-bold text-slate-700">{result.skipped}</p>
              <p className="mt-1 text-xs text-slate-500">Already seen / skipped</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
              <p className="mt-1 text-xs text-red-500">Errors</p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1fr)_90px_90px_90px_90px] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Source</span>
              <span className="text-center">Imported</span>
              <span className="text-center">Enriched</span>
              <span className="text-center">Skipped</span>
              <span className="text-center">Errors</span>
            </div>
            <div className="divide-y divide-slate-100">
              {result.sources.map((source) => (
                <div
                  key={source.source}
                  className="grid grid-cols-[minmax(0,1fr)_90px_90px_90px_90px] items-center px-4 py-3 text-sm text-slate-700"
                >
                  <span>{source.label}</span>
                  <span className="text-center font-medium text-green-700">{source.imported}</span>
                  <span className="text-center font-medium text-blue-700">{source.enriched}</span>
                  <span className="text-center">{source.skipped}</span>
                  <span className="text-center text-red-600">{source.errors.length}</span>
                </div>
              ))}
            </div>
          </div>
          {result.imported > 0 && (
            <div className="mt-4">
              <Link
                href="/admin/submissions"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
              >
                Review new submissions
              </Link>
            </div>
          )}
          {result.errors.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-red-500">Show errors</summary>
              <pre className="mt-2 overflow-x-auto rounded bg-red-50 p-3 text-xs text-red-700">
                {result.errors.join("\n")}
              </pre>
            </details>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-700">Error</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          {error.includes("EVENTBRITE_API_KEY") && (
            <p className="mt-3 text-xs text-red-500">
              Add <code className="rounded bg-red-100 px-1">EVENTBRITE_API_KEY=your_key</code> to{" "}
              <code className="rounded bg-red-100 px-1">.env.local</code> and restart the dev server.
              Get a free key at eventbrite.com/platform.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
