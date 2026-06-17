import { getModeratorSession } from "@/lib/moderator-auth";
import { getPromoterSession } from "@/lib/promoter-auth";
import { getUserSession } from "@/lib/user-auth";

export type PublicPortalLink = {
  href: string;
  label: string;
  shortLabel: string;
};

export async function getPublicPortalLink(): Promise<PublicPortalLink> {
  const [moderatorSession, promoterSession, userSession] = await Promise.all([
    getModeratorSession(),
    getPromoterSession(),
    getUserSession(),
  ]);

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
