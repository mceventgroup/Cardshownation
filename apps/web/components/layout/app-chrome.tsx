"use client";

import { usePathname } from "next/navigation";

function isWorkspacePath(pathname: string) {
  return pathname === "/floorplanner" || pathname.endsWith("/floorplanner");
}

export function AppChrome({
  children,
  header,
  footer,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const workspaceMode = isWorkspacePath(pathname);

  return (
    <div className="flex min-h-screen flex-col">
      {!workspaceMode && header}
      <main className="flex-1">{children}</main>
      {!workspaceMode && footer}
    </div>
  );
}
