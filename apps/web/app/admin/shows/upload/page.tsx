import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminShowUploadPage() {
  await requireAdminSession("/admin/shows/upload");

  return (
    <div className="container-narrow py-6 sm:py-10">
      <Link
        href="/admin/shows"
        className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 transition-colors hover:text-brand-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shows
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          CSV Upload
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Bulk CSV uploads are limited to the promoter portal. Admins can still review promoter uploads in submissions or add shows individually through the admin tools.
        </p>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 text-sm leading-6 text-slate-600 shadow-sm">
        Promoters can download the shared CSV template from their portal, fill it out, and upload it there. This admin page is now informational only.
      </div>
    </div>
  );
}
