import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FloorplanEditorPage } from "@/app/floorplanner/editor-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Floor Planner Test Workspace",
  robots: { index: false, follow: false },
};

export default function FloorplannerTestWorkspacePage() {
  if (process.env.CSN_DATA_MODE !== "fixture") {
    notFound();
  }

  return (
    <div className="h-screen min-h-[640px]">
      <FloorplanEditorPage
        cloudBasePath="/api/floorplanner"
        showLabel="Fixture Floor Planner"
        storageNamespace="e2e-floorplanner"
      />
    </div>
  );
}
