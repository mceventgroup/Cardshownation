import "server-only";
import {
  createDiscordClient,
  syncUpcomingShows,
  type UpcomingDiscordShow,
} from "@/lib/discord-upcoming-shows";
import { getUpcomingShows } from "@/lib/shows";
import { formatShowDate } from "@/lib/utils";

export async function runDiscordUpcomingShowsSync() {
  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  const channelId = process.env.DISCORD_UPCOMING_SHOWS_CHANNEL_ID?.trim();
  if (!botToken || !channelId) {
    throw new Error(
      "Discord sync is not configured. Set DISCORD_BOT_TOKEN and DISCORD_UPCOMING_SHOWS_CHANNEL_ID.",
    );
  }

  const state = process.env.DISCORD_UPCOMING_SHOWS_STATE?.trim().toUpperCase() || "KS";
  const { shows } = await getUpcomingShows({ state, limit: 50 });
  const discordShows: UpcomingDiscordShow[] = shows.map((show) => ({
    slug: show.slug,
    title: show.title,
    startDate: show.startDate.toISOString().slice(0, 10),
    dateLabel: formatShowDate(show.startDate, show.endDate),
    city: `${show.city}, ${show.state}`,
    venue: show.venue?.name || "See show details",
    description:
      show.vendorDetails ||
      (show.categories.length
        ? `${show.categories.join(", ")} show in ${show.city}, ${show.state}.`
        : `Card show in ${show.city}, ${show.state}.`),
  }));

  return syncUpcomingShows(discordShows, createDiscordClient(botToken, channelId), {
    siteUrl:
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://cardshownation.com",
  });
}
