import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return <main className="container-narrow py-10"><article className="rounded-3xl border border-slate-200 bg-white p-6 leading-7 text-slate-700 sm:p-10">
    <h1 className="text-3xl font-semibold text-slate-950">Privacy Policy</h1><p className="mt-2 text-sm">Effective June 23, 2026.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Information we collect</h2><p className="mt-2">We collect account details, alert preferences, show submissions, promoter information, floor-plan content, security logs, and technical information needed to operate Card Show Nation.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">How we use information</h2><p className="mt-2">We use information to provide accounts, publish shows, deliver requested alerts, secure the service, prevent abuse, provide support, and improve the product. Optional analytics and advertising are disabled unless you accept them.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Sharing and retention</h2><p className="mt-2">We use providers for hosting, databases, storage, email, analytics, and advertising. We do not sell account contact information. Public show and promoter information is visible to visitors. We retain data while needed for service, legal, security, and backup purposes.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Your choices</h2><p className="mt-2">You can change alerts, unsubscribe, choose essential-only cookies, or delete your account. Contact privacy@cardshownation.com for access or correction requests.</p>
  </article></main>;
}
