import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { isFixtureMode } from "@/lib/data-mode";
import { getAdminPromoters } from "@/lib/promoters";

export const dynamic = "force-dynamic";

export default async function AdminPromotersPage() {
  await requireAdminSession("/admin/promoters");

  if (isFixtureMode()) {
    return (
      <div className="p-6 lg:p-10">
        <h1 className="text-2xl font-bold text-slate-900">Promoters</h1>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Promoter management is unavailable in fixture mode because organizer accounts are stored
          in the live database schema.
        </div>
      </div>
    );
  }

  const promoters = await getAdminPromoters();

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">
          Promoters
          <span className="ml-2 text-base font-normal text-slate-400">
            ({promoters.length.toLocaleString()})
          </span>
        </h1>
      </div>

      {promoters.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-400">
          No promoter accounts yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Promoter
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Moderation
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">
                  Trusted Cities
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Shows
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promoters.map((promoter) => (
                <tr key={promoter.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{promoter.name}</p>
                      {promoter.verified && (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-700">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {promoter.email ?? "No organizer email"}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                    {promoter.user?.email ?? "No linked account"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        promoter.moderationStatus === "TRUSTED"
                          ? "bg-green-50 text-green-700"
                          : promoter.moderationStatus === "BLOCKED"
                            ? "bg-red-50 text-red-700"
                            : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {promoter.moderationStatus.toLowerCase()}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="text-slate-500">{promoter.approvals.length}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {promoter._count.shows.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/promoters/${promoter.id}`}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
