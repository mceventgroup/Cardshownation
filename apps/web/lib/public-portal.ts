import { getModeratorSession } from "@/lib/moderator-auth";
import { getPromoterSession } from "@/lib/promoter-auth";
import { getUserSession } from "@/lib/user-auth";

export type PublicPortalLink = {
  href: string;
  label: string;
  shortLabel: string;
};

export async function getPublicPortalLink(): Promise<PublicPortalLink> {
  let moderatorSession: Awaited<ReturnType<typeof getModeratorSession>> = null;
  let promoterSession: Awaited<ReturnType<typeof getPromoterSession>> = null;
  let userSession: Awaited<ReturnType<typeof getUserSession>> = null;

  try {
    [moderatorSession, promoterSession, userSession] = await Promise.all([
      getModeratorSession(),
      getPromoterSession(),
      getUserSession(),
    ]);
  } catch (error) {
    console.error("[public portal] failed to resolve session state", error);
  }

  if (moderatorSession) {
    return {
      href: "/moderator",
      label: "Moderator Dashboard",
      shortLabel: "Dashboard",
    };
  }

  if (promoterSession) {
    return {
      href: "/promoter",
      label: "My Dashboard",
      shortLabel: "Dashboard",
    };
  }

  if (userSession) {
    return {
      href: "/account",
      label: "My Account",
      shortLabel: "Account",
    };
  }

  return {
    href: "/login",
    label: "Login",
    shortLabel: "Login",
  };
}
