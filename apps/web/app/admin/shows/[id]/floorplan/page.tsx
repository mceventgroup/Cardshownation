import type { Metadata } from "next";
import Link from "next/link";
import { getLatestShowFloorplan } from "@/lib/floorplans";
import { requireAdminFloorplanAccess } from "@/lib/floorplan-auth";
import { FloorplanEditorPage } from "@/app/floorplanner/editor-page";

export const metadata: Metadata = {
  title: "Admin Show Floorplanner",
  description: "Review and edit a show floorplan as an admin.",
  robots: { index: false, follow: false },
};

export default async function AdminShowFloorplanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireAdminFloorplanAccess(id);
  const initialCloudLayout = await getLatestShowFloorplan(id);

  return (
    <div className="h-[calc(100vh-4rem)] min-h-[720px]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            Admin
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-950">
            {access.show.title}
          </h1>
        </div>
        <Link
          href={`/admin/shows/${encodeURIComponent(id)}`}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Back to show
        </Link>
      </div>
      <FloorplanEditorPage
        cloudBasePath={`/api/floorplanner/shows/${id}`}
        initialCloudLayout={initialCloudLayout}
        showLabel={`${access.show.title} (Admin)`}
        storageNamespace={`show-${id}`}
      />
    </div>
  );
}
