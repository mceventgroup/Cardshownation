import type { Metadata } from "next";
import Link from "next/link";
import { Accessibility, Cookie, CreditCard, FileText, LockKeyhole } from "lucide-react";

export const metadata: Metadata = {
  title: "Legal Center",
  description: "Card Show Nation policies, terms, billing information, and accessibility commitment.",
};

const documents = [
  { href: "/privacy", title: "Privacy Policy", description: "What information we handle, why we use it, and your choices.", icon: LockKeyhole },
  { href: "/terms", title: "Terms of Use", description: "Rules for accounts, listings, promoter tools, and Floor Planner use.", icon: FileText },
  { href: "/cookies", title: "Cookie Policy", description: "Essential and optional technologies used on the site.", icon: Cookie },
  { href: "/billing-terms", title: "Billing Terms", description: "Subscription renewal, cancellation, plan changes, and refunds.", icon: CreditCard },
  { href: "/accessibility", title: "Accessibility Statement", description: "Our accessibility approach and how to report a barrier.", icon: Accessibility },
];

export default function LegalCenterPage() {
  return (
    <div className="container-wide py-10 sm:py-14">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Legal Center</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Policies made easier to find and understand</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">Review how Card Show Nation handles information, operates accounts and subscriptions, and works to provide an accessible experience.</p>
      </header>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" aria-hidden="true" /></div>
            <h2 className="mt-5 text-lg font-semibold text-slate-950 group-hover:text-brand-800">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            <span className="mt-5 inline-flex text-sm font-semibold text-brand-700">Read document <span aria-hidden="true" className="ml-1">→</span></span>
          </Link>
        ))}
      </div>
      <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
        <h2 className="text-lg font-semibold text-slate-950">Need help?</h2>
        <p className="mt-2">For general questions, email <a href="mailto:support@cardshownation.com" className="font-semibold text-brand-700 underline-offset-4 hover:underline">support@cardshownation.com</a>. For privacy requests, email <a href="mailto:privacy@cardshownation.com" className="font-semibold text-brand-700 underline-offset-4 hover:underline">privacy@cardshownation.com</a>.</p>
      </div>
    </div>
  );
}
