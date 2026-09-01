import Link from "next/link";

const links = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/billing-terms", label: "Billing" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/contact", label: "Contact" },
];

export function CompactLegalFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
      <nav aria-label="Legal and support links" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="transition-colors hover:text-slate-900">
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
