import { Menu, X } from "lucide-react";

export function MobileMenu({
  children,
  label = "Menu",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors marker:content-none hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800">
        <Menu className="h-4 w-4 group-open:hidden" aria-hidden="true" />
        <X className="hidden h-4 w-4 group-open:block" aria-hidden="true" />
        {label}
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
        {children}
      </div>
    </details>
  );
}
