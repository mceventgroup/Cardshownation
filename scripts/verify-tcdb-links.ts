import * as nextEnv from "@next/env";

async function main() {
nextEnv.loadEnvConfig("apps/web");
const { db } = await import("../apps/web/lib/db");

const publicLinks = await db.show.count({
  where: {
    OR: [
      { websiteUrl: { contains: "tcdb.com", mode: "insensitive" } },
      { facebookUrl: { contains: "tcdb.com", mode: "insensitive" } },
      { ticketUrl: { contains: "tcdb.com", mode: "insensitive" } },
      { flyerImageUrl: { contains: "tcdb.com", mode: "insensitive" } },
    ],
  },
});
const payloadRows = await db.$queryRawUnsafe<Array<{ count: number }>>(
  `SELECT COUNT(*)::int AS count FROM "ShowSubmission" WHERE CAST("payloadJson" AS text) ILIKE '%tcdb.com%'`
);
const submissionLinks = Number(payloadRows[0]?.count ?? 0);
console.log(JSON.stringify({ publicLinks, submissionLinks }));
await db.$disconnect();
if (publicLinks > 0 || submissionLinks > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
