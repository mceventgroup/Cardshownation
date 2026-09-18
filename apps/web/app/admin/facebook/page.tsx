import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { roundupPresets, validateRoundupRange } from "@/lib/facebook-roundups";
import { getFacebookConnection, getFacebookPublishingHistory, getFacebookRoundupDrafts } from "@/lib/facebook-roundups-server";
import { FacebookComposer } from "./facebook-composer";

export const dynamic = "force-dynamic";

export default async function FacebookPage({ searchParams }: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  await requireAdminSession("/admin/facebook");
  const params = await searchParams;
  const presets = roundupPresets();
  const range = { start: params.start ?? presets.thisWeek.start, end: params.end ?? presets.thisWeek.end };
  const rangeError = validateRoundupRange(range);
  const [connection, drafts] = await Promise.all([
    getFacebookConnection(), rangeError ? Promise.resolve([]) : getFacebookRoundupDrafts(range),
  ]);
  const history = await getFacebookPublishingHistory(connection.pageId, range);
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-10">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Card Show Nation · Social</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">This week, by state</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Turn upcoming shows into Facebook posts. Choose your dates, review each state, and publish directly to your Page.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <p className="font-semibold text-slate-900">{connection.pageName}</p>
          <p className={`mt-1 text-xs ${connection.ready ? "text-emerald-700" : "text-slate-500"}`}>
            {connection.ready ? "Page verified · Ready to review posts" : "Setup needed to publish"}
          </p>
        </div>
      </div>

      {connection.error && <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{connection.error} You can still preview and copy posts.</p>}
      {history.error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{history.error}</p>}

      <section aria-label="Post dates" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries({ "This week": presets.thisWeek, "Next week": presets.nextWeek, "Next 7 days": presets.nextSevenDays }).map(([label, value]) => (
            <Link key={label} href={`/admin/facebook?start=${value.start}&end=${value.end}`}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${range.start === value.start && range.end === value.end ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {label}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-slate-700">From
            <input type="date" name="start" required defaultValue={range.start} key={`start-${range.start}`} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">Through
            <input type="date" name="end" required defaultValue={range.end} key={`end-${range.end}`} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <button className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Generate posts</button>
        </form>
        <p className="mt-3 text-xs text-slate-500">“This week” means today through Sunday, using Central time. Includes approved shows that overlap your dates, including ongoing multi-day shows. Past shows are excluded.</p>
        {rangeError && <p role="alert" className="mt-3 text-sm text-red-700">{rangeError}</p>}
      </section>

      {!rangeError && <FacebookComposer key={`${range.start}:${range.end}:${connection.pageId}:${drafts.map((draft) => draft.fingerprint).join(":")}`}
        range={range} drafts={drafts} history={history.posts} pageId={connection.pageId}
        pageName={connection.pageName} canPublish={connection.ready && !history.error} />}

      <details className="mt-8 rounded-xl border border-slate-200 bg-white p-5" open={!connection.ready}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Connect a Facebook Page</summary>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <p>A one-time setup connects the Page you manage. Posts go live only when you select “Publish to Facebook” on a reviewed post.</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>In your Meta developer app, obtain a Page access token for the Page you manage with <code>pages_manage_posts</code> and <code>pages_read_engagement</code>. Listing your Pages also requires <code>pages_show_list</code>.</li>
            <li>Add <code>FACEBOOK_PAGE_ID</code> and <code>FACEBOOK_PAGE_ACCESS_TOKEN</code> as private server environment settings, then redeploy. Never put the token in a public setting or paste it into a post.</li>
            <li>Apply the Facebook publishing-history migration and use live show data. Refresh this screen to verify the Page name before publishing.</li>
          </ol>
          <p><a href="https://developers.facebook.com/docs/pages-api/posts/" target="_blank" rel="noreferrer" className="font-medium text-brand-700 underline">Meta Page publishing guide</a></p>
        </div>
      </details>
    </div>
  );
}
