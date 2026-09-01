"use server";

import { redirect } from "next/navigation";
import { endPromoterSession } from "@/lib/promoter-auth";
import { endUserSession } from "@/lib/user-auth";

export async function logoutPromoter() {
  await Promise.all([endPromoterSession(), endUserSession()]);
  redirect("/login");
}
