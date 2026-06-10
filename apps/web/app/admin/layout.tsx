import Link from "next/link";
import {
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map,
  RefreshCw,
  Send,
  Upload,
  Users,
} from "lucide-react";
import { logoutAdmin } from "@/app/admin/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-4 py-5">
          <Link href="/admin" className="text-sm font-bold text-slate-900">
            CSN Admin
          </Link>
          <p className="mt-0.5 text-xs text-slate-400">Card Show Nation</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {[
            { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
            { href: "/admin/floorplanner", label: "Floorplanner", icon: Map },
            { href: "/admin/submissions", label: "Submissions", icon: Send },
            { href: "/admin/shows", label: "All Shows", icon: ListChecks },
            { href: "/admin/promoters", label: "Promoters", icon: Users },
            { href: "/admin/users", label: "Users", icon: Users },
            { href: "/admin/import", label: "Import CSV", icon: Upload },
            { href: "/admin/imports", label: "Auto-Import", icon: RefreshCw },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 px-3 py-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:text-slate-600"
          >
            Back to site
          </Link>
          <form action={logoutAdmin} className="mt-2">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-slate-50">{children}</main>
    </div>
  );
}
