"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { isFixtureMode } from "@/lib/data-mode";
import { createFacebookClient, FacebookRequestError } from "@/lib/facebook-client";
import { FACEBOOK_MESSAGE_LIMIT, roundupToday, validateRoundupRange, type RoundupRange } from "@/lib/facebook-roundups";
import { getFacebookConfig, getFacebookRoundupDrafts } from "@/lib/facebook-roundups-server";
import { publishReservedFacebookPost, type FacebookPublishResult } from "@/lib/facebook-publishing";
import { US_STATES } from "@/lib/states";

type PublishInput = RoundupRange & { state: string; message: string; fingerprint: string; pageId: string };

export async function publishFacebookRoundup(input: PublishInput): Promise<FacebookPublishResult> {
  const session = await requireAdminSession("/admin/facebook");
  const fail = (error: string, blocked = false): FacebookPublishResult => ({ ok: false, error, blocked });
  if (isFixtureMode()) return fail("Publishing sample data is disabled.", true);
  const rangeError = validateRoundupRange(input);
  if (rangeError) return fail(rangeError);
  if (input.end < roundupToday()) return fail("This date range has ended. Generate a new preview.", true);
  if (!US_STATES.some((state) => state.code === input.state)) return fail("Choose a valid state.");
  if (typeof input.message !== "string" || !input.message.trim() || input.message.length > FACEBOOK_MESSAGE_LIMIT) {
    return fail(`Post text must contain between 1 and ${FACEBOOK_MESSAGE_LIMIT.toLocaleString()} characters.`);
  }
  const config = getFacebookConfig();
  if (!config || config.pageId !== input.pageId) return fail("Your Page connection has changed. Refresh before publishing.", true);
  try {
    const draft = (await getFacebookRoundupDrafts(input)).find((item) => item.state === input.state);
    if (!draft || draft.fingerprint !== input.fingerprint) {
      return fail("Show details changed since this preview. Refresh and review the updated post.", true);
    }
    const client = createFacebookClient(config);
    await client.getPage();
    const key = { pageId: config.pageId, state: input.state, rangeStart: input.start, rangeEnd: input.end };
    const where = { pageId_state_rangeStart_rangeEnd: key };
    const result = await publishReservedFacebookPost({
      async reserve() {
        const data = { message: input.message, actorId: session.user.id, status: "PUBLISHING", error: null };
        try {
          await db.facebookRoundupPost.create({ data: { ...key, ...data } });
          return true;
        } catch (error) {
          if ((error as { code?: string }).code !== "P2002") throw error;
          // Only an explicit rejection is retryable; concurrent/unknown/successful attempts remain locked.
          const retry = await db.facebookRoundupPost.updateMany({ where: { ...key, status: "FAILED" }, data });
          return retry.count === 1;
        }
      },
      async published(postId) {
        await db.facebookRoundupPost.update({ where, data: { status: "PUBLISHED", postId, error: null } });
      },
      async failed(status, error) {
        await db.facebookRoundupPost.update({ where, data: { status, error } });
      },
    }, () => client.publish(input.message));
    revalidatePath("/admin/facebook");
    return result;
  } catch (error) {
    return fail(error instanceof FacebookRequestError ? error.message : "Publishing is unavailable. Check the database setup and connection, then refresh.");
  }
}
