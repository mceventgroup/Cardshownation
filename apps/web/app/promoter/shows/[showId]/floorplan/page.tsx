import type { Metadata } from "next";
import Link from "next/link";
import { getLatestShowFloorplan } from "@/lib/floorplans";
import { requirePromoterFloorplanAccess } from "@/lib/floorplan-auth";
import { FloorplanEditorPage } from "@/app/floorplanner/editor-page";

export const metadata: Metadata = {
  title: "Promoter Show Floorplanner",
  description: "Build and manage a show floorplan from the promoter portal.",
};

export default async function PromoterShowFloorplanPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const access = await requirePromoterFloorplanAccess(showId);
  const initialCloudLayout = await getLatestShowFloorplan(showId);

  return (
    <div className="h-[calc(100vh-4rem)] min-h-[720px]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            Promoter Floorplanner
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-950">{access.show.title}</h1>
        </div>
        <Link
          href="/promoter"
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Back to portal
        </Link>
      </div>
      <FloorplanEditorPage
        cloudBasePath={`/api/floorplanner/shows/${showId}`}
        initialCloudLayout={initialCloudLayout}
        showLabel={access.show.title}
        storageNamespace={`show-${showId}`}
      />
    </div>
  );
}
