import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { getDataModeLabel, isFixtureMode } from "@/lib/data-mode";
import { getPendingSubmissions } from "@/lib/submissions";
import {
  getAdminShowStats,
  getRecentAdminShows,
} from "@/lib/shows";
import { formatShowDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminSession("/admin");

  const [stats, pendingSubmissions, recentShows] = await Promise.all([
    getAdminShowStats(),
    getPendingSubmissions(),
    getRecentAdminShows(10),
  ]);

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          {isFixtureMode() && (
            <p className="mt-2 text-sm text-slate-500">
              Running in {getDataModeLabel().toLowerCase()} for local testing.
            </p>
          )}
        </div>
        <Link
          href="/submit-show"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          + Add Show
        </Link>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Floorplanner</h2>
            <p className="mt-1 text-sm text-slate-500">
              Open the standalone admin floor planning workspace directly.
            </p>
          </div>
          <Link
            href="/admin/floorplanner"
            className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-100"
          >
            Open Floorplanner
          </Link>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Pending Review",
            value: stats.pending,
            color: "text-yellow-600",
            href: "/admin/submissions",
          },
          {
            label: "Approved Shows",
            value: stats.approved,
            color: "text-green-600",
            href: "/admin/shows?status=APPROVED",
          },
          {
            label: "Rejected",
            value: stats.rejected,
            color: "text-red-500",
            href: "/admin/shows?status=REJECTED",
          },
          {
            label: "Stale (90+ days)",
            value: stats.stale,
            color: "text-orange-500",
            href: "/admin/shows?stale=1",
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-brand-300 hover:shadow-sm"
          >
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className={`mt-1 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Pending Submissions
              {pendingSubmissions.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                  {pendingSubmissions.length}
                </span>
              )}
            </h2>
            <Link
              href="/admin/submissions"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              View all →
            </Link>
          </div>

          {pendingSubmissions.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
              All caught up.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingSubmissions.slice(0, 5).map((submission: (typeof pendingSubmissions)[0]) => {
                const payload = submission.payloadJson as Record<string, unknown>;
                return (
                  <div
                    key={submission.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-yellow-100 bg-yellow-50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {typeof payload.showName === "string"
                          ? payload.showName
                          : "Unnamed Show"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {String(payload.city ?? "")}, {String(payload.state ?? "")} · by{" "}
                        {submission.submitterName}
                      </p>
                    </div>
                    <Link
                      href={`/admin/submissions/${submission.id}`}
                      className="shrink-0 rounded-lg border border-yellow-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-yellow-100"
                    >
                      Review
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Shows</h2>
            <Link
              href="/admin/shows"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Manage all →
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Show
                  </th>
                  <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentShows.map((show: any) => (
                  <tr key={show.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/shows/${show.id}`}
                        className="block max-w-[180px] truncate font-medium text-slate-900 transition-colors hover:text-brand-600"
                      >
                        {show.title}
                      </Link>
                      <span className="text-xs text-slate-400">
                        {show.city}, {show.state}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-slate-500 sm:table-cell">
                      {formatShowDate(show.startDate, show.endDate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={show.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {recentShows.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">
                No shows yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    APPROVED: "bg-green-50 text-green-700",
    PENDING: "bg-yellow-50 text-yellow-700",
    REJECTED: "bg-red-50 text-red-600",
    EXPIRED: "bg-slate-100 text-slate-500",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
