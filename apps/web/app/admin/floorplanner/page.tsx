import { requireAdminSession } from "@/lib/admin-auth";
import { FloorplanEditorPage } from "@/app/floorplanner/editor-page";
import { isCloudAuthConfigured } from "@floorplanner/lib/server/cloud-auth";
import { isCloudSaveConfigured } from "@floorplanner/lib/server/cloud-layout-store";

export const dynamic = "force-dynamic";

export default async function AdminFloorplannerPage() {
  await requireAdminSession("/admin/floorplanner");
  const cloudReady = isCloudAuthConfigured() && isCloudSaveConfigured();
  const missingEnvVars = [
    !process.env.DATABASE_URL ? "DATABASE_URL" : null,
    !process.env.FLOORPLANNER_ADMIN_PASSWORD && !process.env.FLOORPLANNER_SAVE_KEY
      ? "FLOORPLANNER_ADMIN_PASSWORD"
      : null,
    !process.env.FLOORPLANNER_SESSION_SECRET ? "FLOORPLANNER_SESSION_SECRET" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="flex h-screen min-h-[720px] flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            Admin Workspace
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-950">Floorplanner</h1>
          <p className="mt-1 text-sm text-slate-500">
            Standalone planning workspace with optional show assignment deferred.
          </p>
        </div>
      </div>
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
              Browser saves ready
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                cloudReady
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {cloudReady ? "Cloud save enabled" : "Cloud save not configured"}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {cloudReady
              ? "Saved Layouts includes browser and cloud storage."
              : `Cloud save needs: ${missingEnvVars.join(", ")}.`}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <FloorplanEditorPage
          cloudBasePath="/api/floorplanner"
          showLabel="Admin Workspace"
          storageNamespace="admin"
        />
      </div>
    </div>
  );
}
