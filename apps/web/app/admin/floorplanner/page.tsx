import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { getRecentAdminShows } from "@/lib/shows";
import { formatShowDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminFloorplannerPage() {
  await requireAdminSession("/admin/floorplanner");

  const recentShows = await getRecentAdminShows(12);

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Floorplanner</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Open the floor planning workspace for a show. Access remains restricted to
            admin routes.
          </p>
        </div>
        <Link
          href="/admin/shows"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Browse all shows
        </Link>
      </div>

      <div className="mb-8 rounded-xl border border-brand-100 bg-brand-50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Open a show floorplan
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Use the show detail page for full admin controls, or jump straight into
              Floorplanner from the recent shows list below.
            </p>
          </div>
          <Link
            href="/admin/shows"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Go to show management
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Recent shows</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Show
              </th>
              <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">
                Date
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recentShows.map((show: any) => (
              <tr key={show.id} className="transition-colors hover:bg-slate-50">
                <td className="px-5 py-4">
                  <p className="font-medium text-slate-900">{show.title}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {show.city}, {show.state}
                  </p>
                </td>
                <td className="hidden px-5 py-4 text-xs text-slate-500 md:table-cell">
                  {formatShowDate(show.startDate, show.endDate)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/shows/${show.id}`}
                      className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                    >
                      Show details
                    </Link>
                    <Link
                      href={`/admin/shows/${show.id}/floorplan`}
                      className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-100"
                    >
                      Open Floorplan
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {recentShows.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            No shows available yet.
          </div>
        )}
      </div>
    </div>
  );
}
