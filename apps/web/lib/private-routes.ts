const PRIVATE_ROUTE_PREFIXES = [
  "/account",
  "/admin",
  "/moderator",
  "/promoter",
] as const;

const PRIVATE_EXACT_ROUTES = new Set([
  "/floorplanner/billing",
  "/floorplanner/workspace",
  "/login",
]);

export function isPrivateBrowserRoute(pathname: string): boolean {
  if (PRIVATE_EXACT_ROUTES.has(pathname)) return true;
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
