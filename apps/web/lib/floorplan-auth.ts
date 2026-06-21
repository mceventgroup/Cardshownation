import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminSession, requireAdminSession } from "@/lib/admin-auth";
import { getPromoterSession, requirePromoterSession } from "@/lib/promoter-auth";

export type FloorplanAccess = {
  actorUserId: string;
  show: {
    id: string;
    title: string;
    venueId: string | null;
  };
};

async function findPromoterShow(showId: string, organizerId: string) {
  return db.show.findFirst({
    where: {
      id: showId,
      organizerId,
    },
    select: {
      id: true,
      title: true,
      venueId: true,
    },
  });
}

async function findAdminShow(showId: string) {
  return db.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      title: true,
      venueId: true,
    },
  });
}

export async function requirePromoterFloorplanAccess(showId: string): Promise<FloorplanAccess> {
  const session = await requirePromoterSession(`/promoter/shows/${showId}/floorplan`);
  if (!session.organizer.floorplanEnabled) {
    notFound();
  }
  const show = await findPromoterShow(showId, session.organizer.id);
  if (!show) {
    notFound();
  }

  return {
    actorUserId: session.user.id,
    show,
  };
}

export async function requireAdminFloorplanAccess(showId: string): Promise<FloorplanAccess> {
  const session = await requireAdminSession(`/admin/shows/${showId}/floorplan`);
  const show = await findAdminShow(showId);
  if (!show) {
    notFound();
  }

  return {
    actorUserId: session.user.id,
    show,
  };
}

export async function getPromoterFloorplanAccess(showId: string): Promise<FloorplanAccess | null> {
  const session = await getPromoterSession();
  if (!session || !session.organizer.floorplanEnabled) {
    return null;
  }

  const show = await findPromoterShow(showId, session.organizer.id);
  if (!show) {
    return null;
  }

  return {
    actorUserId: session.user.id,
    show,
  };
}

export async function getAdminFloorplanAccess(showId: string): Promise<FloorplanAccess | null> {
  const session = await getAdminSession();
  if (!session) {
    return null;
  }

  const show = await findAdminShow(showId);
  if (!show) {
    return null;
  }

  return {
    actorUserId: session.user.id,
    show,
  };
}
