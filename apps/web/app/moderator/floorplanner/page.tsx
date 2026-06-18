import { requireModeratorSession } from "@/lib/moderator-auth";
import { FloorplanEditorPage } from "@/app/floorplanner/editor-page";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ModeratorFloorplannerPage() {
  await requireModeratorSession("/moderator/floorplanner");
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasCloudPassword = Boolean(
    process.env.FLOORPLANNER_ADMIN_PASSWORD?.trim() ||
      process.env.FLOORPLANNER_SAVE_KEY?.trim(),
  );
  const hasCloudSessionSecret = Boolean(process.env.FLOORPLANNER_SESSION_SECRET?.trim());
  const cloudReady = hasDatabaseUrl && hasCloudPassword && hasCloudSessionSecret;
  const missingEnvVars = [
    !hasDatabaseUrl ? "DATABASE_URL" : null,
    !hasCloudPassword ? "FLOORPLANNER_ADMIN_PASSWORD" : null,
    !hasCloudSessionSecret ? "FLOORPLANNER_SESSION_SECRET" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="flex h-screen min-h-[720px] flex-col bg-slate-950">
      <div className="border-b border-slate-800 bg-slate-950/96 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/moderator"
              className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              Back to Moderator
            </Link>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Moderator Workspace
              </p>
              <h1 className="text-lg font-semibold text-white">Floorplanner</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-100">
              Browser saves ready
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                cloudReady
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
                  : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30"
              }`}
            >
              {cloudReady ? "Cloud save enabled" : "Cloud save not configured"}
            </span>
            {!cloudReady && (
              <span className="text-xs text-slate-400">
                Needs: {missingEnvVars.join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <FloorplanEditorPage
          cloudBasePath="/api/floorplanner"
          showLabel="Moderator Workspace"
          storageNamespace="moderator"
        />
      </div>
    </div>
  );
}
