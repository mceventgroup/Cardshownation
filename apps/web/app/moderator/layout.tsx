import Link from "next/link";
import { ClipboardCheck, LayoutDashboard, LogOut, Map } from "lucide-react";
import { getModeratorSession } from "@/lib/moderator-auth";
import { logoutModerator } from "@/app/moderator/actions";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default async function ModeratorLayout({ children }: { children: React.ReactNode }) {
  const session = await getModeratorSession();
  const navItems = [
    { href: "/moderator", label: "Dashboard", icon: LayoutDashboard },
    { href: "/moderator/submissions", label: "Submissions", icon: ClipboardCheck },
    { href: "/moderator/floorplanner", label: "Floorplanner", icon: Map },
  ];

  return (
    <WorkspaceShell
      homeHref="/moderator"
      brand="CSN Moderator"
      subtitle="Review queue"
      desktopSidebar={
        <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
          <div className="border-b border-slate-100 px-4 py-5">
            <Link href="/moderator" className="text-sm font-bold text-slate-900">
              CSN Moderator
            </Link>
            <p className="mt-0.5 text-xs text-slate-400">Review queue</p>
          </div>
          <nav className="flex-1 space-y-0.5 px-3 py-4">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}

            {session ? (
              <form action={logoutModerator}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </form>
            ) : (
              <Link
                href="/moderator/login"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="h-4 w-4 rotate-180" />
                Log in
              </Link>
            )}
          </nav>
        </aside>
      }
      mobileHeader={
        <header className="border-b border-slate-200 bg-white md:hidden">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <Link href="/moderator" className="text-sm font-bold text-slate-900">
              CSN Moderator
            </Link>
            <p className="mt-0.5 text-xs text-slate-400">Review queue</p>
          </div>

          {session ? (
            <form action={logoutModerator}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </form>
          ) : (
            <Link
              href="/moderator/login"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
            >
              <LogOut className="h-4 w-4 rotate-180" />
              Log in
            </Link>
          )}
        </div>

        <nav className="flex gap-2 overflow-x-auto px-4 pb-4">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>
      }
    >
      {children}
    </WorkspaceShell>
  );
}
