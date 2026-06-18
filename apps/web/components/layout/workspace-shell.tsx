"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type WorkspaceShellProps = {
  children: React.ReactNode;
  homeHref: string;
  brand: string;
  subtitle: string;
  launchHref?: string;
  launchLabel?: string;
  desktopSidebar?: React.ReactNode;
  mobileHeader?: React.ReactNode;
  topBar?: React.ReactNode;
};

function isFloorplannerRoute(pathname: string) {
  return pathname === "/floorplanner" || pathname.endsWith("/floorplanner");
}

export function WorkspaceShell({
  children,
  homeHref,
  brand,
  subtitle,
  launchHref,
  launchLabel,
  desktopSidebar,
  mobileHeader,
  topBar,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const floorplannerMode = isFloorplannerRoute(pathname);

  if (floorplannerMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {topBar}
        <main className="min-h-0">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {mobileHeader}
      {desktopSidebar}
      <main className="min-w-0 flex-1">
        {topBar ?? (
          <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Link href={homeHref} className="text-sm font-semibold text-slate-900">
                  {brand}
                </Link>
                <p className="text-xs text-slate-500">{subtitle}</p>
              </div>
              {launchHref && launchLabel ? (
                <Link
                  href={launchHref}
                  className="inline-flex items-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  {launchLabel}
                </Link>
              ) : null}
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
