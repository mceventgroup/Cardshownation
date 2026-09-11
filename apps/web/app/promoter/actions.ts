"use server";

import { redirect } from "next/navigation";
import { endAllSessions } from "@/lib/logout";

export async function logoutPromoter() {
  await endAllSessions();
  redirect("/login");
}
