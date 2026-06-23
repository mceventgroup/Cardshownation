"use server";

import { redirect } from "next/navigation";
import { endUserSession, requireUserSession } from "@/lib/user-auth";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";

export async function logoutUser() {
  await endUserSession();
  redirect("/account/login");
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
  const confirmation = formData.get("deleteConfirmation");
  if (typeof password !== "string" || confirmation !== "DELETE") {
    redirect("/account?error=delete");
  }
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/account?error=delete");
  }
  await db.user.delete({ where: { id: session.user.id } });
  await endUserSession();
  redirect("/?accountDeleted=1");
}
