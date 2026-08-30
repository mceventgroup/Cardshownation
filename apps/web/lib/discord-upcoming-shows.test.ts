import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDesiredMessages,
  parseManagedMessage,
  planDiscordSync,
  syncUpcomingShows,
  type DiscordClient,
  type DiscordMessage,
  type UpcomingDiscordShow,
} from "@/lib/discord-upcoming-shows";

function show(overrides: Partial<UpcomingDiscordShow> = {}): UpcomingDiscordShow {
  return {
    slug: "wichita-october-10",
    title: "Card Show Nation - Wichita",
    startDate: "2026-10-10",
    dateLabel: "Oct 10, 2026",
    city: "Wichita, KS",
    venue: "Convention Center",
    description: "Sports cards, Pokemon, and collectibles.",
    ...overrides,
  };
}

function asExisting(
  id: string,
  desired: ReturnType<typeof buildDesiredMessages>[number],
): DiscordMessage {
  return { id, embeds: desired.payload.embeds };
}

test("builds only current and future messages in date order", () => {
  const messages = buildDesiredMessages(
    [
      show({ slug: "past", startDate: "2026-08-28" }),
      show({ slug: "later", startDate: "2026-12-19" }),
      show({ slug: "today", startDate: "2026-08-29" }),
    ],
    "https://cardshownation.com/",
    "2026-08-29",
  );

  assert.deepEqual(messages.map((message) => message.slug), ["today", "later"]);
  assert.equal(messages[0].payload.embeds[0].url, "https://cardshownation.com/shows/today");
  assert.deepEqual(parseManagedMessage(asExisting("1", messages[0])), {
    slug: "today",
    signature: messages[0].signature,
  });
});

test("plans updates, creates, stale deletes, duplicate deletes, and leaves other posts", () => {
  const desired = buildDesiredMessages(
    [show({ slug: "unchanged" }), show({ slug: "changed" }), show({ slug: "new" })],
    "https://cardshownation.com",
    "2026-01-01",
  );
  const oldChanged = buildDesiredMessages(
    [show({ slug: "changed", venue: "Old venue" })],
    "https://cardshownation.com",
    "2026-01-01",
  )[0];
  const stale = buildDesiredMessages(
    [show({ slug: "stale" })],
    "https://cardshownation.com",
    "2026-01-01",
  )[0];
  const desiredBySlug = new Map(desired.map((message) => [message.slug, message]));

  assert.deepEqual(
    planDiscordSync(desired, [
      asExisting("same", desiredBySlug.get("unchanged")!),
      asExisting("duplicate", desiredBySlug.get("unchanged")!),
      asExisting("old", oldChanged),
      asExisting("stale", stale),
      { id: "human", embeds: [{ footer: { text: "A regular channel post" } }] },
    ]).map((action) =>
      action.type === "delete"
        ? [action.type, action.messageId, action.reason]
        : [action.type, action.desired.slug],
    ),
    [
      ["update", "changed"],
      ["create", "new"],
      ["delete", "duplicate", "duplicate"],
      ["delete", "stale", "stale"],
    ],
  );
});

test("a second synchronization is stable", async () => {
  const stored: DiscordMessage[] = [];
  let nextId = 1;
  const client: DiscordClient = {
    async listMessages() {
      return structuredClone(stored);
    },
    async createMessage(payload) {
      stored.push({ id: String(nextId++), embeds: structuredClone(payload.embeds) });
    },
    async updateMessage(messageId, payload) {
      const message = stored.find((candidate) => candidate.id === messageId);
      assert.ok(message);
      message.embeds = structuredClone(payload.embeds);
    },
    async deleteMessage(messageId) {
      stored.splice(
        stored.findIndex((candidate) => candidate.id === messageId),
        1,
      );
    },
  };

  assert.deepEqual(
    await syncUpcomingShows([show()], client, {
      siteUrl: "https://cardshownation.com",
      today: "2026-01-01",
    }),
    { upcomingShows: 1, created: 1, updated: 0, deleted: 0, unchanged: 0 },
  );
  assert.deepEqual(
    await syncUpcomingShows([show()], client, {
      siteUrl: "https://cardshownation.com",
      today: "2026-01-01",
    }),
    { upcomingShows: 1, created: 0, updated: 0, deleted: 0, unchanged: 1 },
  );
});
