import { Prisma } from "@csn/db";
import { db } from "@/lib/db";

let hasOrganizerFloorplanEnabledColumnPromise: Promise<boolean> | null = null;

export async function hasOrganizerFloorplanEnabledColumn() {
  if (!hasOrganizerFloorplanEnabledColumnPromise) {
    hasOrganizerFloorplanEnabledColumnPromise = db
      .$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
        select exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'Organizer'
            and column_name = 'floorplanEnabled'
        ) as "exists"
      `)
      .then((rows) => Boolean(rows[0]?.exists))
      .catch((error) => {
        console.error("[organizer-schema] floorplanEnabled column probe failed", error);
        return false;
      });
  }

  return hasOrganizerFloorplanEnabledColumnPromise;
}
