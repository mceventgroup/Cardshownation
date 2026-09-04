type Review = {
  kind: "show" | "submission";
  id: string;
  score: number;
  record: Record<string, unknown>;
  submittedInfo: number;
  existingInfo: number;
  recommendation: "submission" | "existing";
};

function text(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value) && value.length) return value.join(", ");
  return "—";
}

export function DuplicateReviewCard({ submitted, review, area, mergeAction, approveDistinctAction, claimAction }: { submitted: Record<string, unknown>; review: Review | null; area: "admin" | "moderator"; mergeAction?: (formData: FormData) => Promise<void>; approveDistinctAction?: (formData: FormData) => Promise<void>; claimAction?: (formData: FormData) => Promise<void> }) {
  if (!review) return <div className="mb-8 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-800"><strong>No close match found.</strong> Date, city, state, title, and venue checks passed.</div>;
  const isClaim = submitted.submissionIntent === "CLAIM_OR_UPDATE";
  const likely = review.score >= 72;
  const href = review.kind === "show" ? `/shows/${String(review.record.slug ?? review.id)}` : `/${area}/submissions/${review.id}`;
  const enrichableFields = mergeMissingShowDetails(review.record, submitted).changedFields
    .map((field) => ENRICHABLE_SHOW_FIELD_LABELS[field] ?? field);
  const rows = (isClaim
    ? [["Name", "showName"], ["Start date", "startDate"], ["End date", "endDate"], ["Start time", "startTimeLabel"], ["End time", "endTimeLabel"], ["City", "city"], ["State", "state"], ["Venue", "venueName"], ["Address", "venueAddress"], ["Categories", "categories"], ["Description", "description"], ["Admission", "admissionPrice"], ["Free admission", "isFree"], ["Tables", "tableCount"], ["Vendor details", "vendorDetails"], ["Parking", "parkingInfo"], ["Website", "websiteUrl"], ["Facebook", "facebookUrl"]]
    : [["Name", "showName"], ["Date", "startDate"], ["Venue", "venueName"], ["Address", "venueAddress"], ["Description", "description"], ["Website", "websiteUrl"]]) as readonly (readonly [string, string])[];
  return <section className={`mb-8 rounded-xl border p-5 ${likely || isClaim ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{isClaim ? "Claim and update request" : likely ? "Likely duplicate" : "Possible match"}{!isClaim ? ` · ${review.score}%` : ""}</h2><p className="mt-1 text-sm text-slate-600">{isClaim ? "Compare the requested values with the current live listing. Approval applies the reviewed values and connects the show to the requesting promoter." : <>Recommendation: keep the <strong>{review.recommendation === "submission" ? "new submission" : "existing listing"}</strong>; it has {Math.max(review.submittedInfo, review.existingInfo)} of 8 useful detail fields.</>}</p></div><a href={href} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-700 underline">Open {isClaim ? "live listing" : "match"}</a></div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr><th className="p-2 text-slate-500">Field</th><th className="p-2 text-slate-800">New submission</th><th className="p-2 text-slate-800">Existing match</th></tr></thead><tbody>{rows.map(([label, key]) => <tr key={key} className="border-t border-slate-200"><th className="p-2 text-xs font-medium text-slate-500">{label}</th><td className="p-2 align-top text-slate-800">{text(submitted, key)}</td><td className="p-2 align-top text-slate-800">{text(review.record, key)}</td></tr>)}</tbody></table></div>
    {!isClaim && likely && enrichableFields.length > 0 && <p className="mt-4 rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700"><strong>Safe additions available:</strong> {enrichableFields.join(", ")}. Existing values will not be overwritten.</p>}
    {isClaim && claimAction && <form action={claimAction} className="mt-4 rounded-xl border border-amber-300 bg-white/80 p-4"><label className="flex items-start gap-2 text-xs leading-5 text-slate-700"><input type="checkbox" name="confirmClaim" value="yes" required className="mt-1 rounded border-slate-300 text-brand-600" /><span>I verified the requester&apos;s relationship and reviewed the replacement values above.</span></label><textarea name="notes" rows={2} placeholder="Optional approval note" className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button type="submit" className="mt-3 w-full rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800">Approve claim and apply updates</button></form>}
    {!isClaim && likely && (mergeAction || approveDistinctAction) && <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {mergeAction && <form action={mergeAction}><button type="submit" className="w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800">Merge safe details into existing</button></form>}
      {approveDistinctAction && <form action={approveDistinctAction} className="rounded-lg border border-amber-300 bg-white/70 p-3"><label className="flex items-start gap-2 text-xs leading-5 text-slate-700"><input type="checkbox" name="confirmDistinct" value="yes" required className="mt-1 rounded border-slate-300 text-brand-600" /><span>I verified these are separate shows.</span></label><button type="submit" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Publish as a separate show</button></form>}
    </div>}
  </section>;
}
import { mergeMissingShowDetails, ENRICHABLE_SHOW_FIELD_LABELS } from "@/lib/show-enrichment";
