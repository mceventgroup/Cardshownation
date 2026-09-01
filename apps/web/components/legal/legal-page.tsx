import Link from "next/link";

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/billing-terms", label: "Billing Terms" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/contact", label: "Contact & Support" },
];

export function LegalPage({ title, summary, updated, currentPath, sections, children }: {
  title: string;
  summary: string;
  updated: string;
  currentPath: string;
  sections: Array<{ id: string; label: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="container-wide py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
          <Link href="/legal" className="block rounded-xl px-3 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100">Legal Center</Link>
          <nav aria-label="Legal documents" className="mt-1 space-y-1">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} aria-current={currentPath === link.href ? "page" : undefined} className={`block rounded-xl px-3 py-2 text-sm transition-colors ${currentPath === link.href ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-700 shadow-sm sm:p-10">
          <header className="border-b border-slate-200 pb-7">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Card Show Nation legal</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{summary}</p>
            <p className="mt-3 text-sm text-slate-500">Last updated {updated}</p>
          </header>

          <nav aria-label="On this page" className="my-7 rounded-2xl bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-950">On this page</p>
            <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {sections.map((section) => (
                <li key={section.id}><a href={`#${section.id}`} className="text-brand-700 underline-offset-4 hover:underline">{section.label}</a></li>
              ))}
            </ul>
          </nav>

          <div className="space-y-9 leading-7">{children}</div>
        </article>
      </div>
    </div>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-28"><h2 className="text-xl font-semibold text-slate-950 sm:text-2xl">{title}</h2><div className="mt-3 space-y-3">{children}</div></section>;
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-brand-600">{children}</ul>;
}

export function LegalContact({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 text-slate-700">{children}</div>;
}
