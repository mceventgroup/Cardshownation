import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

type Correction = { id: string; title: string; city: string; state: string; start: string; storedEnd: string; expectedEnd: string; status: string; description: string; dateHeader: string };
const day = (value: unknown) => new Date(String(value)).toISOString().slice(0, 10);

async function main() {
  const plan: { sourceUrl: string; corrections: Correction[] } = JSON.parse(readFileSync("docs/IMPORTED_DATE_REPAIRS_2026-10-02.json", "utf8"));
  if (plan.corrections.length !== 26 || new Set(plan.corrections.map((row) => row.id)).size !== 26) throw new Error("Unexpected repair manifest");
  for (const row of plan.corrections) {
    if (day(row.start) !== row.start || day(row.expectedEnd) !== row.expectedEnd || row.expectedEnd < row.start || !["APPROVED", "EXPIRED"].includes(row.status)) throw new Error("Invalid correction");
  }
  if (process.argv.includes("--offline")) { console.log("Validated 26 unique, source-verified corrections; no database access."); return; }
  const env = parseEnv(readFileSync("apps/web/.vercel/prod.env", "utf8"));
  if (!env.DATABASE_URL) throw new Error("Missing database credentials");
  const sql = neon(env.DATABASE_URL);
  const ids = plan.corrections.map((row) => row.id);
  const read = () => sql`SELECT id, title, city, state, status, "startDate", "endDate", "expiresAt", description FROM "Show" WHERE id = ANY(${ids}::text[])`;
  const before = await read();
  const eligible: Correction[] = [], alreadyCorrect: string[] = [];
  for (const row of plan.corrections) {
    const live = before.find((item) => item.id === row.id);
    if (!live || live.title !== row.title || live.city !== row.city || live.state !== row.state || day(live.startDate) !== row.start || live.description !== row.description) throw new Error(`Record changed since audit: ${row.id}`);
    if (day(live.endDate) === row.expectedEnd) { alreadyCorrect.push(row.id); continue; }
    if (day(live.endDate) !== row.storedEnd || live.status !== row.status) throw new Error(`Dates/status changed since audit: ${row.id}`);
    eligible.push(row);
  }
  const apply = process.argv.includes("--apply");
  if (!apply) { console.log(JSON.stringify({ mode: "dry-run", eligible: eligible.length, alreadyCorrect: alreadyCorrect.length })); return; }
  mkdirSync(".local-import", { recursive: true });
  writeFileSync(`.local-import/date-repair-before-${Date.now()}.json`, JSON.stringify(before, null, 2));
  const queries = eligible.map((row) => {
    const details = JSON.stringify({ reason: "Source-verified imported-date audit", sourceUrl: plan.sourceUrl, dateHeader: row.dateHeader, previousEndDate: row.storedEnd, nextEndDate: row.expectedEnd });
    // Match the audited values again at write time. A concurrent editor's changes are never overwritten.
    return sql`WITH changed AS (
      UPDATE "Show" SET "endDate" = ${row.expectedEnd}::date,
        "expiresAt" = ${row.expectedEnd}::date + interval '1 day',
        status = CASE WHEN status = 'APPROVED' AND ${row.expectedEnd}::date + interval '1 day' < now() THEN 'EXPIRED'::"ShowStatus" ELSE status END,
        "updatedAt" = now()
      WHERE id = ${row.id} AND title = ${row.title} AND city = ${row.city} AND state = ${row.state}
        AND "startDate"::date = ${row.start}::date AND "endDate"::date = ${row.storedEnd}::date
        AND status::text = ${row.status} AND description = ${row.description}
      RETURNING id
    ) INSERT INTO "AuditLog" (id, action, "targetType", "targetId", details, "createdAt")
      SELECT ${randomUUID()}, 'show.import_date_repaired', 'Show', id, ${details}::jsonb, now() FROM changed RETURNING "targetId"`;
  });
  const results = queries.length ? await sql.transaction(queries) : [];
  const after = await read();
  const remaining = plan.corrections.filter((row) => {
    const live = after.find((item) => item.id === row.id);
    return !live || day(live.endDate) !== row.expectedEnd || day(live.expiresAt) !== day(new Date(Date.parse(row.expectedEnd) + 86400000));
  }).map((row) => row.id);
  const summary = { at: new Date().toISOString(), mode: "apply", corrected: results.flat().length, alreadyCorrect: alreadyCorrect.length, remaining, after };
  writeFileSync(".local-import/date-repair-verification.json", JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ corrected: summary.corrected, alreadyCorrect: alreadyCorrect.length, remaining }));
  if (remaining.length) throw new Error("Some records require review; see verification report");
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
