import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FloorplanEditorPage } from "@/app/floorplanner/editor-page";
import { getFloorplannerWorkspaceSession } from "@/lib/floorplanner-workspace-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Floor Planner Workspace",
  description: "Build and save your card-show floor plan.",
  robots: { index: false, follow: false },
};

export default async function FloorplannerWorkspacePage() {
  const session = await getFloorplannerWorkspaceSession();
  if (!session) {
    redirect("/floorplanner");
  }

  const returnHref =
    session.role === "ADMIN"
      ? "/admin"
      : session.role === "MODERATOR"
        ? "/moderator"
        : session.role === "ORGANIZER"
          ? "/promoter"
          : "/account";
  const showLabel = session.user.name?.trim() || "My Card Show";

  return (
    <div className="flex h-screen min-h-[720px] flex-col bg-slate-950">
      <div className="border-b border-slate-800 bg-slate-950/96 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={returnHref}
              className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              Back to dashboard
            </Link>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Floor Planner
              </p>
              <h1 className="text-lg font-semibold text-white">{showLabel}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
              {session.maxCloudProjects} active cloud project
            </span>
            {session.accessSource === "subscription" && (
              <Link
                href="/floorplanner/billing"
                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              >
                Manage billing
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <FloorplanEditorPage
          cloudBasePath="/api/floorplanner"
          showLabel={showLabel}
          storageNamespace={`account-${session.user.id}`}
        />
      </div>
    </div>
  );
}
