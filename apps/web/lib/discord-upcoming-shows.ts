import { createHash } from "node:crypto";

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
const MARKER_PREFIX = "KCS_UPCOMING_SHOW";
const PAGE_SIZE = 100;

type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text?: string };
};

export type UpcomingDiscordShow = {
  slug: string;
  title: string;
  startDate: string;
  dateLabel: string;
  city: string;
  venue: string;
  description: string;
};

export type DiscordMessagePayload = {
  content: string;
  embeds: DiscordEmbed[];
  allowed_mentions: { parse: string[] };
};

export type DiscordMessage = { id: string; embeds?: DiscordEmbed[] };

export type DesiredDiscordMessage = {
  slug: string;
  signature: string;
  payload: DiscordMessagePayload;
};

export type DiscordSyncAction =
  | { type: "create"; desired: DesiredDiscordMessage }
  | { type: "update"; messageId: string; desired: DesiredDiscordMessage }
  | { type: "delete"; messageId: string; reason: "duplicate" | "stale" };

export type DiscordSyncResult = {
  upcomingShows: number;
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
};

export type DiscordClient = {
  listMessages(): Promise<DiscordMessage[]>;
  createMessage(payload: DiscordMessagePayload): Promise<void>;
  updateMessage(messageId: string, payload: DiscordMessagePayload): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;
};

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeSiteUrl(siteUrl: string) {
  return siteUrl.replace(/\/+$/, "");
}

function markerFor(slug: string, signature: string) {
  return `${MARKER_PREFIX}:${slug}:${signature}`;
}

export function parseManagedMessage(message: DiscordMessage) {
  const footer = message.embeds?.find((embed) =>
    embed.footer?.text?.startsWith(`${MARKER_PREFIX}:`),
  )?.footer?.text;
  const match = footer?.match(/^KCS_UPCOMING_SHOW:(.+):([a-f0-9]{16})$/);
  return match ? { slug: match[1], signature: match[2] } : null;
}

function buildPayload(
  show: UpcomingDiscordShow,
  siteUrl: string,
  footerText: string,
): DiscordMessagePayload {
  const showUrl = `${normalizeSiteUrl(siteUrl)}/shows/${encodeURIComponent(show.slug)}`;

  return {
    content: "",
    embeds: [
      {
        title: truncate(show.title, 256),
        description: truncate(show.description, 4096),
        url: showUrl,
        color: 0x0891b2,
        fields: [
          { name: "Date", value: truncate(show.dateLabel, 1024), inline: true },
          { name: "City", value: truncate(show.city, 1024), inline: true },
          { name: "Venue", value: truncate(show.venue, 1024) },
          { name: "Details", value: `[View show details](${showUrl})` },
        ],
        footer: { text: footerText },
      },
    ],
    allowed_mentions: { parse: [] },
  };
}

export function buildDesiredMessages(
  shows: UpcomingDiscordShow[],
  siteUrl: string,
  today: string,
) {
  return shows
    .filter((show) => show.startDate >= today)
    .sort(
      (left, right) =>
        left.startDate.localeCompare(right.startDate) || left.slug.localeCompare(right.slug),
    )
    .map((show) => {
      const unsignedPayload = buildPayload(show, siteUrl, "");
      const signature = createHash("sha256")
        .update(JSON.stringify(unsignedPayload))
        .digest("hex")
        .slice(0, 16);

      return {
        slug: show.slug,
        signature,
        payload: buildPayload(show, siteUrl, markerFor(show.slug, signature)),
      };
    });
}

export function planDiscordSync(
  desired: DesiredDiscordMessage[],
  existing: DiscordMessage[],
) {
  const actions: DiscordSyncAction[] = [];
  const managedBySlug = new Map<
    string,
    Array<{ message: DiscordMessage; signature: string }>
  >();

  for (const message of existing) {
    const marker = parseManagedMessage(message);
    if (!marker) continue;
    const messages = managedBySlug.get(marker.slug) ?? [];
    messages.push({ message, signature: marker.signature });
    managedBySlug.set(marker.slug, messages);
  }

  for (const item of desired) {
    const candidates = managedBySlug.get(item.slug) ?? [];
    const keeper =
      candidates.find((candidate) => candidate.signature === item.signature) ?? candidates[0];

    if (!keeper) actions.push({ type: "create", desired: item });
    else if (keeper.signature !== item.signature) {
      actions.push({ type: "update", messageId: keeper.message.id, desired: item });
    }

    for (const candidate of candidates) {
      if (candidate !== keeper) {
        actions.push({ type: "delete", messageId: candidate.message.id, reason: "duplicate" });
      }
    }
    managedBySlug.delete(item.slug);
  }

  for (const candidates of managedBySlug.values()) {
    for (const candidate of candidates) {
      actions.push({ type: "delete", messageId: candidate.message.id, reason: "stale" });
    }
  }

  return actions;
}

export async function syncUpcomingShows(
  shows: UpcomingDiscordShow[],
  client: DiscordClient,
  options: { siteUrl: string; today?: string },
): Promise<DiscordSyncResult> {
  const desired = buildDesiredMessages(
    shows,
    options.siteUrl,
    options.today ?? new Date().toISOString().slice(0, 10),
  );
  const actions = planDiscordSync(desired, await client.listMessages());
  const result: DiscordSyncResult = {
    upcomingShows: desired.length,
    created: 0,
    updated: 0,
    deleted: 0,
    unchanged: desired.length,
  };

  for (const action of actions) {
    if (action.type === "create") {
      await client.createMessage(action.desired.payload);
      result.created += 1;
      result.unchanged -= 1;
    } else if (action.type === "update") {
      await client.updateMessage(action.messageId, action.desired.payload);
      result.updated += 1;
      result.unchanged -= 1;
    } else {
      await client.deleteMessage(action.messageId);
      result.deleted += 1;
    }
  }

  return result;
}

async function readDiscordError(response: Response) {
  const body = await response.text();
  return body ? truncate(body, 500) : response.statusText;
}

async function discordRequest<T>(
  botToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
        "User-Agent": "DiscordBot (https://cardshownation.com, 1.0.0)",
        ...init.headers,
      },
      cache: "no-store",
    });

    if (response.ok) {
      return (response.status === 204 ? undefined : await response.json()) as T;
    }
    if (response.status === 429 && attempt < 3) {
      const rateLimit = (await response.json().catch(() => null)) as {
        retry_after?: number;
      } | null;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(250, Math.ceil((rateLimit?.retry_after ?? 1) * 1_000))),
      );
      continue;
    }
    if (response.status >= 500 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      continue;
    }
    throw new Error(`Discord API ${response.status}: ${await readDiscordError(response)}`);
  }
  throw new Error("Discord API request failed after retries.");
}

export function createDiscordClient(botToken: string, channelId: string): DiscordClient {
  return {
    async listMessages() {
      const messages: DiscordMessage[] = [];
      let before: string | undefined;
      for (;;) {
        const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (before) query.set("before", before);
        const page = await discordRequest<DiscordMessage[]>(
          botToken,
          `/channels/${encodeURIComponent(channelId)}/messages?${query}`,
        );
        messages.push(...page);
        if (page.length < PAGE_SIZE) break;
        const nextBefore = page.at(-1)?.id;
        if (!nextBefore || nextBefore === before) break;
        before = nextBefore;
      }
      return messages;
    },
    async createMessage(payload) {
      await discordRequest(botToken, `/channels/${encodeURIComponent(channelId)}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    async updateMessage(messageId, payload) {
      await discordRequest(
        botToken,
        `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
        { method: "PATCH", body: JSON.stringify(payload) },
      );
    },
    async deleteMessage(messageId) {
      await discordRequest(
        botToken,
        `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
        { method: "DELETE" },
      );
    },
  };
}
