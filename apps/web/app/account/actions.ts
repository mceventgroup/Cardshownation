"use server";

import { redirect } from "next/navigation";
import { endUserSession, requireUserSession } from "@/lib/user-auth";
import { endPromoterSession } from "@/lib/promoter-auth";
import { db } from "@/lib/db";
import { isFloorplannerSubscriptionTerminal } from "@/lib/floorplanner-access";
import { verifyPassword } from "@/lib/passwords";
import { deleteCloudLayoutsForUser } from "@floorplanner/lib/server/cloud-layout-store";

export async function logoutUser() {
  await Promise.all([endUserSession(), endPromoterSession()]);
  redirect("/login");
}

export async function unsubscribeAllEmail() {
  const session = await requireUserSession("/account");
  await db.userStateSubscription.updateMany({
    where: { userId: session.user.id },
    data: { emailEnabled: false },
  });
  redirect("/account?unsubscribed=1");
}

export async function deleteMyAccount(formData: FormData) {
  const session = await requireUserSession("/account");
  const password = formData.get("deletePassword");
  const emailConfirmation = formData.get("deleteEmail");
  const confirmation = formData.get("deleteConfirmation");
  if (
    typeof password !== "string" ||
    typeof emailConfirmation !== "string" ||
    confirmation !== "DELETE"
  ) {
    redirect("/account?error=delete");
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      passwordHash: true,
      floorplannerSubscription: {
        select: { status: true },
      },
    },
  });
  const identityConfirmed = user?.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : emailConfirmation.trim().toLowerCase() === user?.email.toLowerCase();
  if (!user || !identityConfirmed) {
    redirect("/account?error=delete");
  }
  if (
    user.floorplannerSubscription &&
    !isFloorplannerSubscriptionTerminal(user.floorplannerSubscription.status)
  ) {
    redirect("/account?error=billing");
  }
  try {
    await deleteCloudLayoutsForUser(session.user.id);
    await db.user.delete({ where: { id: session.user.id } });
  } catch {
    redirect("/account?error=delete");
  }
  await endUserSession();
  redirect("/?accountDeleted=1");
}
