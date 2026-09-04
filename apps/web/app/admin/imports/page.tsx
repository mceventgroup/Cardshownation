import { requireAdminSession } from "@/lib/admin-auth";
import { getAutoImportSourceSummaries } from "@/lib/scheduled-imports";
import { ImportsClient } from "./imports-client";

export const dynamic = "force-dynamic";

export default async function AdminImportsPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  await requireAdminSession("/admin/imports");
  const [sources, sp] = await Promise.all([getAutoImportSourceSummaries(), searchParams]);

  return <ImportsClient sources={sources} initialSource={sp.source ?? "all"} />;
}
