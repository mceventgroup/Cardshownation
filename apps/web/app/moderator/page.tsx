import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutModerator } from "@/app/moderator/actions";
import { getModeratorSession } from "@/lib/moderator-auth";
import { getModeratorDashboardData } from "@/lib/moderators";
import { getModeratorVisibleSubmissions } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export default async function ModeratorDashboardPage() {
  const session = await getModeratorSession();
  if (!session) {
    redirect("/moderator/login");
  }

  const dashboard = await getModeratorDashboardData(session.user.id);
  if (!dashboard) {
    redirect("/moderator/login");
  }
  const visibleSubmissions = await getModeratorVisibleSubmissions(session.user.id);
  const pendingSubmissions = visibleSubmissions
    .filter((submission) => submission.status === "PENDING")
    .slice(0, 5);

  return (
    <div className="container-wide py-6 sm:py-10">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
              Moderator portal
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {dashboard.user.name ?? dashboard.user.email}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Review incoming show submissions, approve clean listings quickly, and flag promoters
              that may be ready for trusted-market approval by admin.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/moderator/submissions"
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Open queue
            </Link>
            <form action={logoutModerator}>
              <button
                type="submit"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Log out
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 [&>*:last-child]:col-span-2 sm:grid-cols-3 sm:[&>*:last-child]:col-span-1">
          <StatCard label="Pending submissions" value={String(dashboard.pendingCount)} />
          <StatCard label="Reviews completed" value={String(dashboard.reviewedCount)} />
          <StatCard label="Queue status" value={dashboard.pendingCount === 0 ? "All clear" : "Ready"} />
        </div>

        <div className="mt-8 border-t border-slate-200 pt-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Next submissions</h2>
              <p className="mt-1 text-sm text-slate-500">Start with the oldest items waiting for review.</p>
            </div>
            <Link href="/moderator/submissions" className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-800">
              View all
            </Link>
          </div>

          {pendingSubmissions.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center text-sm text-slate-500">
              The review queue is clear.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {pendingSubmissions.map((submission) => {
                const payload = submission.payloadJson as Record<string, unknown>;
                return (
                  <Link
                    key={submission.id}
                    href={`/moderator/submissions/${submission.id}`}
                    className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-950">{String(payload.showName ?? "Unnamed show")}</p>
                      <p className="mt-1 text-sm text-slate-500">{String(payload.city ?? "")}{payload.state ? `, ${String(payload.state)}` : ""} · Submitted {new Date(submission.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="self-start rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800 sm:self-auto">Review</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

