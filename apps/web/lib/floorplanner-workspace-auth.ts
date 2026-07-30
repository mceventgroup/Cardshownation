import { getAdminSession } from "@/lib/admin-auth";
import { hasActiveFloorplannerSubscription } from "@/lib/floorplanner-billing";
import { getModeratorSession } from "@/lib/moderator-auth";
import { getPromoterSession } from "@/lib/promoter-auth";
import { getUserSession } from "@/lib/user-auth";

export type FloorplannerWorkspaceRole =
  | "ADMIN"
  | "MODERATOR"
  | "ORGANIZER"
  | "FAN";

export type FloorplannerWorkspaceSession = {
  role: FloorplannerWorkspaceRole;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  maxCloudProjects: number;
  accessSource: "staff" | "subscription" | "complimentary";
};

export async function getFloorplannerCustomerSession() {
  const promoterSession = await getPromoterSession();
  if (promoterSession) {
    return {
      role: "ORGANIZER" as const,
      user: promoterSession.user,
      organizer: promoterSession.organizer,
    };
  }

  const userSession = await getUserSession();
  if (userSession) {
    return {
      role: "FAN" as const,
      user: userSession.user,
      organizer: null,
    };
  }

  return null;
}

export async function getFloorplannerWorkspaceSession(): Promise<FloorplannerWorkspaceSession | null> {
  const adminSession = await getAdminSession();
  if (adminSession) {
    return {
      role: "ADMIN",
      user: adminSession.user,
      maxCloudProjects: 10,
      accessSource: "staff",
    };
  }

  const moderatorSession = await getModeratorSession();
  if (moderatorSession) {
    return {
      role: "MODERATOR",
      user: moderatorSession.user,
      maxCloudProjects: 10,
      accessSource: "staff",
    };
  }

  const customerSession = await getFloorplannerCustomerSession();
  if (!customerSession) {
    return null;
  }

  if (await hasActiveFloorplannerSubscription(customerSession.user.id)) {
    return {
      role: customerSession.role,
      user: customerSession.user,
      maxCloudProjects: 1,
      accessSource: "subscription",
    };
  }

  if (
    customerSession.role === "ORGANIZER" &&
    customerSession.organizer?.floorplanEnabled
  ) {
    return {
      role: customerSession.role,
      user: customerSession.user,
      maxCloudProjects: 1,
      accessSource: "complimentary",
    };
  }

  return null;
}
