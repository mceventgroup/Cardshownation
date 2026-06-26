import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminShows } from "@/lib/shows";
import { formatShowDate } from "@/lib/utils";

type SearchParams = { status?: string; stale?: string; page?: string; q?: string };

export const dynamic = "force-dynamic";

export default async function AdminShowsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminSession("/admin/shows");

  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const limit = 30;
  const offset = (page - 1) * limit;
  const staleDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const { shows, total } = await getAdminShows({
    status: sp.status,
    stale: sp.stale === "1",
    q: sp.q,
    limit,
    offset,
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const statusFilters = [
    { label: "All", href: "/admin/shows" },
    { label: "Approved", href: "/admin/shows?status=APPROVED" },
    { label: "Pending", href: "/admin/shows?status=PENDING" },
    { label: "Rejected", href: "/admin/shows?status=REJECTED" },
    { label: "Stale (90d)", href: "/admin/shows?stale=1" },
  ];
  const filterHref = (href: string) => {
    const [pathname, queryString] = href.split("?");
    const params = new URLSearchParams(queryString ?? "");
    if (sp.q) {
      params.set("q", sp.q);
    }

    const serialized = params.toString();
    return serialized ? `${pathname}?${serialized}` : pathname;
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">
          Shows
          <span className="ml-2 text-base font-normal text-slate-400">
            ({total.toLocaleString()})
          </span>
        </h1>
      </div>

      <form action="/admin/shows" method="get" className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search by show, city, slug, or promoter"
              className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          {sp.stale && <input type="hidden" name="stale" value={sp.stale} />}
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Search
          </button>
          {sp.q && (
            <Link
              href={filterHref(
                sp.status ? `/admin/shows?status=${sp.status}` : sp.stale ? "/admin/shows?stale=1" : "/admin/shows"
              )}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {statusFilters.map((filter) => {
          const isActive =
            filter.href === "/admin/shows"
              ? !sp.status && !sp.stale
              : filter.href.includes("stale")
                ? sp.stale === "1"
                : sp.status ===
                  new URLSearchParams(filter.href.split("?")[1]).get("status");

          return (
            <Link
              key={filter.href}
              href={filterHref(filter.href)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Show
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">
                Date
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">
                Last Verified
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shows.map((show: any) => {
              const isStale =
                show.status === "APPROVED" &&
                (!show.lastVerifiedAt || show.lastVerifiedAt < staleDate);

              return (
                <tr
                  key={show.id}
                  className={`transition-colors hover:bg-slate-50 ${
                    isStale ? "bg-orange-50/40" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="leading-snug text-slate-900">{show.title}</p>
                    <p className="text-xs text-slate-400">
                      {show.city}, {show.state}
                    </p>
                    {show.organizer && (
                      <p className="mt-1 text-xs text-slate-400">
                        Promoter: {show.organizer.name ?? show.organizer.email ?? "Assigned"}
                      </p>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                    {formatShowDate(show.startDate, show.endDate)}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {show.lastVerifiedAt ? (
                      <span className="text-xs text-slate-500">
                        {new Date(show.lastVerifiedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-xs text-orange-500">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={show.status} stale={isStale} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/shows/${show.slug}`}
                        target="_blank"
                        className="text-xs text-slate-400 transition-colors hover:text-slate-600"
                      >
                        View ↗
                      </Link>
                      <Link
                        href={`/admin/shows/${show.id}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {shows.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-400">
            No shows found.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/shows?${new URLSearchParams({
                ...sp,
                page: String(page - 1),
              })}`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              ← Previous
            </Link>
          )}
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/shows?${new URLSearchParams({
                ...sp,
                page: String(page + 1),
              })}`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, stale }: { status: string; stale: boolean }) {
  if (stale) {
    return (
      <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600">
        Stale
      </span>
    );
  }

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
