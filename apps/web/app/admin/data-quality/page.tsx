import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Link2Off, SearchCheck, ShieldCheck } from "lucide-react";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  deleteQualityShow,
  getDataQualityReport,
  keepShowsSeparate,
  markQualityShowExpired,
  mergeQualityShows,
  runShowLinkScan,
  type LinkQualityIssue,
  type QualityShowRecord,
} from "@/lib/data-quality";
import { formatShowDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function resultPath(result: string) {
  return `/admin/data-quality?result=${encodeURIComponent(result)}`;
}

async function keepSeparate(showIds: string[], formData: FormData) {
  "use server";
  const session = await requireAdminSession("/admin/data-quality");
  if (formData.get("confirmDistinct") !== "yes") redirect(resultPath("confirmation-required"));
  await keepShowsSeparate(showIds, { actorId: session.user.id, actorRole: "ADMIN" });
  redirect(resultPath("kept-separate"));
}

async function mergeShows(keepId: string, removeId: string, formData: FormData) {
  "use server";
  const session = await requireAdminSession("/admin/data-quality");
  if (formData.get("confirmMerge") !== "yes") redirect(resultPath("confirmation-required"));
  try {
    await mergeQualityShows(keepId, removeId, { actorId: session.user.id, actorRole: "ADMIN" });
  } catch (error) {
    console.error("[data quality] merge failed", error);
    redirect(resultPath("merge-failed"));
  }
  redirect(resultPath("merged"));
}

async function deleteShow(showId: string, formData: FormData) {
  "use server";
  const session = await requireAdminSession("/admin/data-quality");
  if (String(formData.get("deleteConfirmation") ?? "").trim().toUpperCase() !== "DELETE") redirect(resultPath("confirmation-required"));
  await deleteQualityShow(showId, { actorId: session.user.id, actorRole: "ADMIN" });
  redirect(resultPath("deleted"));
}

async function expireShow(showId: string) {
  "use server";
  const session = await requireAdminSession("/admin/data-quality");
  await markQualityShowExpired(showId, { actorId: session.user.id, actorRole: "ADMIN" });
  redirect(resultPath("expired"));
}

async function checkLinks() {
  "use server";
  const session = await requireAdminSession("/admin/data-quality");
  await runShowLinkScan({ actorId: session.user.id, actorRole: "ADMIN" });
  redirect(resultPath("links-checked"));
}

function ResultNotice({ result }: { result?: string }) {
  const messages: Record<string, { tone: string; text: string }> = {
    "kept-separate": { tone: "border-green-200 bg-green-50 text-green-800", text: "These shows were marked as separate and will not be flagged together again." },
    merged: { tone: "border-green-200 bg-green-50 text-green-800", text: "The listings were safely merged. Favorites, reports, tags, and floor plans were preserved." },
    deleted: { tone: "border-green-200 bg-green-50 text-green-800", text: "The selected listing was deleted and the action was recorded." },
    expired: { tone: "border-green-200 bg-green-50 text-green-800", text: "The past listing was marked expired." },
    "links-checked": { tone: "border-green-200 bg-green-50 text-green-800", text: "Link check finished. Results are shown below." },
    "confirmation-required": { tone: "border-amber-200 bg-amber-50 text-amber-900", text: "The requested action was not completed because its confirmation was missing." },
    "merge-failed": { tone: "border-red-200 bg-red-50 text-red-800", text: "The merge was stopped because the listings no longer passed the duplicate safety check." },
  };
  const notice = result ? messages[result] : null;
  return notice ? <p role="status" className={`mb-6 rounded-xl border px-4 py-3 text-sm ${notice.tone}`}>{notice.text}</p> : null;
}

function ShowIdentity({ show }: { show: QualityShowRecord }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-slate-950">{show.title}</p>
      <p className="mt-1 text-sm text-slate-600">{formatShowDate(show.startDate, show.endDate)} · {show.city}, {show.state}</p>
      <p className="mt-1 text-xs text-slate-400">{show.venue?.name ?? "Venue not listed"} · {show.organizer?.name ?? "No promoter attached"}</p>
    </div>
  );
}

function ShowLinks({ show }: { show: QualityShowRecord }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs font-semibold">
      <Link href={`/shows/${show.slug}`} target="_blank" className="text-slate-500 hover:text-slate-800">Live page ↗</Link>
      <Link href={`/admin/shows/${show.id}`} className="text-brand-700 hover:text-brand-800">Edit details</Link>
    </div>
  );
}

function DeleteControl({ show }: { show: QualityShowRecord }) {
  const action = deleteShow.bind(null, show.id);
  return (
    <details className="mt-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-red-700">Delete this listing</summary>
      <form action={action} className="mt-3 space-y-2">
        <p className="text-xs leading-5 text-red-800">Permanent. Type DELETE to confirm. Merge is preferred when another listing should remain.</p>
        <input name="deleteConfirmation" required pattern="DELETE" placeholder="DELETE" className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm" />
        <button type="submit" className="w-full rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800">Delete permanently</button>
      </form>
    </details>
  );
}

function IssueList({ title, description, items }: { title: string; description: string; items: Array<{ show: QualityShowRecord; issues: string[] }> }) {
  return (
    <section id={title.toLowerCase().replace(/\s+/g, "-")} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6"><h2 className="text-lg font-semibold text-slate-950">{title} <span className="text-slate-400">({items.length})</span></h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
      {items.length ? <div className="divide-y divide-slate-100">{items.slice(0, 50).map(({ show, issues }) => <article key={show.id} className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><ShowIdentity show={show} /><p className="mt-3 text-sm text-amber-800">{issues.join(" · ")}</p></div><ShowLinks show={show} /></article>)}</div> : <EmptyState text="No findings in this category." />}
      {items.length > 50 && <p className="border-t border-slate-100 p-4 text-center text-xs text-slate-500">Showing the first 50. Use All Shows to work through the remainder.</p>}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex items-center gap-2 p-6 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" />{text}</div>;
}

export default async function DataQualityPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  await requireAdminSession("/admin/data-quality");
  const [report, sp] = await Promise.all([getDataQualityReport(), searchParams]);
  const liveLinkIssues = [...report.suspiciousLinks, ...(report.linkScan?.issues ?? [])].filter((issue, index, all) => all.findIndex((candidate) => candidate.showId === issue.showId && candidate.field === issue.field && candidate.url === issue.url) === index);
  const duplicateListingCount = report.duplicateGroups.reduce((total, group) => total + group.shows.length, 0);

  return (
    <div className="p-5 sm:p-6 lg:p-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Catalog maintenance</p><h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Data Quality Center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review likely duplicates and incomplete or outdated listings. The scan never changes or deletes a show by itself.</p></div>
        <form action={checkLinks}><button type="submit" className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"><SearchCheck className="h-4 w-4" />Check stored links</button></form>
      </div>

      <ResultNotice result={sp.result} />
      {report.scanLimitReached && <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">The catalog exceeds {report.scanned.toLocaleString()} listings. This view shows the newest scanned records.</p>}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          ["Duplicate groups", report.duplicateGroups.length, "#duplicates"],
          ["Listings in groups", duplicateListingCount, "#duplicates"],
          ["Missing essentials", report.missingDetails.length, "#missing-essentials"],
          ["Date or venue conflicts", report.conflicts.length, "#date-or-venue-conflicts"],
          ["Approved past", report.approvedPast.length, "#approved-past-shows"],
          ["Link findings", liveLinkIssues.length, "#link-review"],
        ].map(([label, value, href]) => <a key={String(label)} href={String(href)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-200"><p className="text-2xl font-bold text-slate-950">{Number(value).toLocaleString()}</p><p className="mt-1 text-xs font-semibold text-slate-500">{label}</p></a>)}
      </div>

      <div className="space-y-8">
        <section id="duplicates" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-brand-700" /><div><h2 className="text-lg font-semibold text-slate-950">Likely duplicate groups <span className="text-slate-400">({report.duplicateGroups.length})</span></h2><p className="mt-1 text-sm text-slate-500">The recommended keeper has the most useful information. Review dates and names before acting.</p></div></div></div>
          {report.duplicateGroups.length ? <div className="divide-y divide-slate-200">{report.duplicateGroups.map((group) => {
            const keeper = group.shows.find((show) => show.id === group.recommendedKeepId)!;
            const keepSeparateAction = keepSeparate.bind(null, group.shows.map((show) => show.id));
            return <article key={group.key} className="p-5 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Up to {group.score}% match</span><p className="mt-2 text-sm text-slate-500">{group.shows.length} listings · recommended keeper highlighted</p></div><form action={keepSeparateAction} className="flex items-center gap-2"><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="confirmDistinct" value="yes" required />These are separate</label><button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Stop flagging</button></form></div><div className="grid gap-3 lg:grid-cols-2">{group.shows.map((show) => {
              const recommended = show.id === keeper.id;
              const mergeAction = !recommended ? mergeShows.bind(null, keeper.id, show.id) : null;
              return <div key={show.id} className={`rounded-2xl border p-4 ${recommended ? "border-green-300 bg-green-50/60" : "border-slate-200 bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><ShowIdentity show={show} />{recommended && <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-800">Keep</span>}</div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{show.completeness} detail points</span><span>{show._count.savedBy} saves</span><span>{show._count.floorplans} floor plans</span></div><div className="mt-3"><ShowLinks show={show} /></div>{mergeAction && <form action={mergeAction} className="mt-4 rounded-xl border border-brand-200 bg-white p-3"><label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" name="confirmMerge" value="yes" required className="mt-1" /><span>Merge this into <strong>{keeper.title}</strong> and remove this duplicate.</span></label><button type="submit" className="mt-2 w-full rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800">Merge into recommended keeper</button></form>}<DeleteControl show={show} /></div>;
            })}</div></article>;
          })}</div> : <EmptyState text="No likely duplicate groups found." />}
        </section>

        <section id="approved-past-shows" className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5 sm:p-6"><h2 className="text-lg font-semibold text-slate-950">Approved past shows <span className="text-slate-400">({report.approvedPast.length})</span></h2><p className="mt-1 text-sm text-slate-500">Past dates are excluded from public discovery, but these records still need their status cleaned up.</p></div>{report.approvedPast.length ? <div className="divide-y divide-slate-100">{report.approvedPast.slice(0, 50).map((show) => <article key={show.id} className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center"><ShowIdentity show={show} /><div className="flex flex-wrap items-center gap-3"><ShowLinks show={show} /><form action={expireShow.bind(null, show.id)}><button className="rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900">Mark expired</button></form></div></article>)}</div> : <EmptyState text="No approved past shows need cleanup." />}</section>

        <IssueList title="Missing essentials" description="Upcoming approved shows missing information collectors commonly need." items={report.missingDetails} />
        <IssueList title="Date or venue conflicts" description="Listings with dates in the wrong order or a venue in a different market." items={report.conflicts} />

        <section id="link-review" className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-950">Link review <span className="text-slate-400">({liveLinkIssues.length})</span></h2><p className="mt-1 text-sm text-slate-500">Unsafe, malformed, shortened, prohibited, or unreachable stored links.</p></div><Link2Off className="h-5 w-5 text-slate-400" /></div>{report.linkScan && <p className="mt-3 text-xs text-slate-400">Last reachability check: {new Date(report.linkScan.checkedAt).toLocaleString()} · {report.linkScan.checked} links checked{report.linkScan.truncated ? " · scan limit reached" : ""}</p>}</div>{liveLinkIssues.length ? <div className="divide-y divide-slate-100">{liveLinkIssues.slice(0, 100).map((issue: LinkQualityIssue) => <article key={`${issue.showId}-${issue.field}-${issue.url}`} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-semibold text-slate-900">{issue.showTitle}</p><p className="mt-1 break-all text-xs text-slate-500">{issue.field}: {issue.url}</p><p className="mt-2 flex items-center gap-2 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{issue.problem}</p></div><Link href={`/admin/shows/${issue.showId}`} className="text-xs font-semibold text-brand-700 hover:text-brand-800">Review and edit</Link></article>)}</div> : <EmptyState text={report.linkScan ? "No stored link problems found." : "No obvious unsafe links found. Run the stored-link check to test reachability."} />}</section>
      </div>
    </div>
  );
}
