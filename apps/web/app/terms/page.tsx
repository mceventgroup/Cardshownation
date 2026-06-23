import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return <main className="container-narrow py-10"><article className="rounded-3xl border border-slate-200 bg-white p-6 leading-7 text-slate-700 sm:p-10">
    <h1 className="text-3xl font-semibold text-slate-950">Terms of Use</h1><p className="mt-2 text-sm">Effective June 23, 2026.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Using the service</h2><p className="mt-2">Provide accurate information, protect your account, and use Card Show Nation lawfully. Do not interfere with the service, scrape it abusively, impersonate others, upload malicious content, or attempt unauthorized access.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Listings and floor plans</h2><p className="mt-2">Submitters are responsible for listing accuracy and rights to uploaded material. We may review or remove content. Floor plans are planning aids; promoters remain responsible for venue rules, accessibility, safety, and emergency requirements.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Beta availability</h2><p className="mt-2">The beta service is provided as available and may change. Verify events with promoters before traveling or purchasing. We are not responsible for event cancellations or vendor transactions.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Accounts</h2><p className="mt-2">We may suspend abusive accounts. You may delete your account in settings. Questions may be sent to support@cardshownation.com.</p>
  </article></main>;
}
