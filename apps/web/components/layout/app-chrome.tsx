"use client";

import { usePathname } from "next/navigation";

function isWorkspacePath(pathname: string) {
  return (
    pathname.startsWith("/moderator") ||
    pathname === "/floorplanner/workspace" ||
    (pathname !== "/floorplanner" && pathname.endsWith("/floorplanner"))
  );
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
      {workspaceMode ? (
        <div id="main-content" tabIndex={-1} className="flex-1 outline-none">{children}</div>
      ) : (
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">{children}</main>
      )}
      {!workspaceMode && footer}
    </div>
  );
}
