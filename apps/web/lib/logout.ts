import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-session";
import { MODERATOR_COOKIE_NAME } from "@/lib/moderator-session";
import { PROMOTER_COOKIE_NAME } from "@/lib/promoter-session";
import { USER_COOKIE_NAME } from "@/lib/user-session";
import { CLOUD_SESSION_COOKIE } from "@floorplanner/lib/server/cloud-auth";

export async function endAllSessions() {
  const cookieStore = await cookies();
  // Roles can coexist in one browser. Leaving any session behind can send the
  // login page straight back to a dashboard or keep floorplanner access active.
  for (const name of [
    ADMIN_COOKIE_NAME,
    MODERATOR_COOKIE_NAME,
    PROMOTER_COOKIE_NAME,
    USER_COOKIE_NAME,
    CLOUD_SESSION_COOKIE,
  ]) {
    cookieStore.delete(name);
  }
}
