import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutPromoter } from "@/app/promoter/actions";
import { getPromoterSession, getPromoterSessionSecret } from "@/lib/promoter-auth";
import { getPromoterDashboardData } from "@/lib/promoters";
import { formatShowDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PromoterPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; status?: string }>;
}) {
  const [session, secret, sp] = await Promise.all([
    getPromoterSession(),
    getPromoterSessionSecret(),
    searchParams,
  ]);

  if (!secret) {
    return (
      <div className="container-narrow py-10">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em]">
            Promoter portal unavailable
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Promoter access is temporarily unavailable
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Please try again later or contact support if you need immediate access.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <PromoterLandingPage />;
  }

  const dashboard = await getPromoterDashboardData(session.user.id);
  if (!dashboard) {
    redirect("/promoter/login");
  }

  const notice =
    sp.created === "1"
      ? sp.status === "approved"
        ? "Show published."
        : "Show submitted for admin review."
      : null;

  return (
    <div className="container-wide py-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
                Promoter portal
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {dashboard.organizer.name}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Create shows faster, reuse your saved organizer details, and manage repeat events
                from one organizer account.
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/promoter/new-show"
                className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Add show
              </Link>
              <Link
                href="/promoter/upload"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Upload CSV
              </Link>
              <form action={logoutPromoter}>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Log out
                </button>
              </form>
            </div>
          </div>

          {notice && (
            <p className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {notice}
            </p>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard label="Shows on account" value={String(dashboard.showCount)} />
            <StatCard
              label="Trusted cities"
              value={String(dashboard.approvals.length)}
            />
            <StatCard label="Recent status" value="Admin managed" />
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950">Recent shows</h2>
              <Link
                href="/promoter/new-show"
                className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
              >
                Create another
              </Link>
            </div>

            {dashboard.shows.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-lg font-semibold text-slate-900">
                  No shows on this account yet
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Your organizer profile is ready. Add your first show and the portal will
                  remember your promoter details next time.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {dashboard.shows.map((show) => (
                  <div
                    key={show.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-950">
                          {show.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {show.city}, {show.state} · {formatShowDate(show.startDate, show.endDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {dashboard.organizer.floorplanEnabled ? (
                          <Link
                            href={`/promoter/shows/${encodeURIComponent(show.id)}/floorplan`}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                          >
                            Open floor plan
                          </Link>
                        ) : null}
                        <Link
                          href={`/promoter/new-show?copy=${encodeURIComponent(show.id)}`}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                        >
                          Duplicate
                        </Link>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            show.status === "APPROVED"
                              ? "bg-green-100 text-green-700"
                              : show.status === "PENDING"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {show.status.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Trusted cities
            </p>
            {dashboard.approvals.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Admin can approve repeat markets for your account after reviewing your submitted
                shows.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {dashboard.approvals.map((approval) => (
                  <div
                    key={approval.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {approval.city}, {approval.state}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {approval.approvedShowCount} approved shows in this market
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-300">
              Flyer spec
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Mobile-first artwork</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Upload JPG, PNG, or WebP artwork and the portal will fit it into a
              1200x1600 WebP flyer. That keeps the card layout sharp on phones
              without forcing exact export dimensions up front.
            </p>
            <Link
              href="/promoter/new-show"
              className="mt-5 inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100"
            >
              Add show with flyer
            </Link>
            <Link
              href="/promoter/upload"
              className="mt-3 inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Bulk upload CSV
            </Link>
          </section>
        </aside>
      </div>
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

function PromoterLandingPage() {
  return (
    <div className="container-wide py-6 sm:py-10">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          Promoter portal
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Create repeat shows without retyping the same promoter details every time
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
          Save your organizer profile once, post shows from your phone, and keep repeat events
          tied to the same organizer account.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/promoter/signup"
            className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Create promoter account
          </Link>
          <Link
            href="/promoter/login"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Log in
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {[
          {
            title: "Saved promoter profile",
            body: "Your organizer name, contact email, and links stay attached to your account so each new show starts mostly filled in.",
          },
          {
            title: "City-based trust",
            body: "Admin can approve specific city and state markets for repeat submissions after a promoter has built trust there.",
          },
          {
            title: "Flyer rules built in",
            body: "Upload JPG, PNG, or WebP artwork and the form will convert it into a mobile-first 1200x1600 WebP flyer automatically.",
          },
        ].map((item) => (
          <section
            key={item.title}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-slate-950">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
