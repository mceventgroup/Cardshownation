import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { isFixtureMode } from "@/lib/data-mode";
import { getAllFixtureShows } from "@/lib/fixture-store";
import { createFacebookClient, type FacebookConfig } from "@/lib/facebook-client";
import { buildFacebookRoundups, roundupToday, validateRoundupRange, type RoundupRange } from "@/lib/facebook-roundups";

export function getFacebookConfig(): FacebookConfig | null {
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim() || "";
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || "";
  const apiVersion = process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || "v25.0";
  return /^\d+$/.test(pageId) && accessToken && accessToken !== "replace-me" && /^v\d+\.0$/.test(apiVersion)
    ? { pageId, accessToken, apiVersion } : null;
}

export async function getFacebookConnection() {
  const fixture = isFixtureMode();
  const config = getFacebookConfig();
  if (fixture) return { ready: false, pageId: "", pageName: "Preview mode", error: "Sample data is enabled. Facebook publishing is disabled." };
  if (!config) return { ready: false, pageId: "", pageName: "No Page connected", error: "Connect your Facebook Page using the setup instructions below." };
  try {
    const page = await createFacebookClient(config).getPage();
    return { ready: true, pageId: page.id, pageName: page.name, error: null };
  } catch (error) {
    return { ready: false, pageId: config.pageId, pageName: "Connection needs attention", error: error instanceof Error ? error.message : "Could not verify your Page." };
  }
}

export async function getFacebookRoundupDrafts(range: RoundupRange) {
  const error = validateRoundupRange(range);
  if (error) throw new Error(error);
  const now = new Date();
  const earliest = range.start > roundupToday(now) ? range.start : roundupToday(now);
  const endExclusive = new Date(`${range.end}T00:00:00Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const shows = isFixtureMode() ? await getAllFixtureShows() : await db.show.findMany({
    where: {
      status: "APPROVED", startDate: { lt: endExclusive },
      endDate: { gte: new Date(`${earliest}T00:00:00Z`) },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
    select: {
      id: true, slug: true, title: true, status: true, state: true, city: true,
      startDate: true, endDate: true, expiresAt: true, startTimeLabel: true, endTimeLabel: true,
      venue: { select: { name: true } },
    },
  });
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://cardshownation.com";
  return buildFacebookRoundups(shows, range, siteUrl, now).map((draft) => ({
    ...draft, fingerprint: createHash("sha256").update(draft.message).digest("hex"),
  }));
}

export async function getFacebookPublishingHistory(pageId: string, range: RoundupRange) {
  if (isFixtureMode() || !pageId) return { posts: [], error: null };
  try {
    const posts = await db.facebookRoundupPost.findMany({
      where: { pageId, rangeStart: range.start, rangeEnd: range.end },
      select: { state: true, status: true, postId: true, error: true, message: true },
    });
    return { posts, error: null };
  } catch {
    return { posts: [], error: "Publishing history is unavailable. Complete the database setup or restore its connection before publishing." };
  }
}
