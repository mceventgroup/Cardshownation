import { db } from "@/lib/db";
import { normalizeExternalUrl } from "@/lib/url";

export type PublicImportSource = {
  id?: string;
  name: string;
  url: string;
  city?: string;
  state?: string;
  organizerName?: string;
  categories?: string[];
  facebookUrl?: string;
  active?: boolean;
  origin?: "database" | "environment";
};

export type AutoImportSourceInput = {
  name: string;
  url: string;
  city?: string;
  state?: string;
  organizerName?: string;
  categories?: string[] | string;
  facebookUrl?: string;
  active?: boolean;
};

const BUILT_IN_PUBLIC_IMPORT_SOURCES: PublicImportSource[] = [
  {
    name: "Beckett Card Shows",
    url: "https://www.beckett.com/news/?s=card+show",
    organizerName: "Beckett",
    categories: ["Sports Cards", "Pokemon", "TCG"],
    active: true,
    origin: "environment",
  },
];

export function isMissingAutoImportSourceTableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("autoimportsource") &&
    (
      message.includes("does not exist") ||
      message.includes("unknown") ||
      message.includes("no such table") ||
      message.includes("invalid `db.autoimportsource")
    )
  );
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeCategories(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function parsePublicImportSources(raw = process.env.PUBLIC_SHOW_IMPORT_SOURCES_JSON): PublicImportSource[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return [];
      }

      const source = entry as Record<string, unknown>;
      const name = readTrimmedString(source.name);
      const url = normalizeExternalUrl(readTrimmedString(source.url));
      if (!name || !url) {
        return [];
      }

      return [
        {
          name,
          url,
          city: readTrimmedString(source.city),
          state: readTrimmedString(source.state)?.toUpperCase(),
          organizerName: readTrimmedString(source.organizerName),
          categories: normalizeCategories(source.categories),
          facebookUrl: normalizeExternalUrl(readTrimmedString(source.facebookUrl)) ?? undefined,
          active: true,
          origin: "environment",
        } satisfies PublicImportSource,
      ];
    });
  } catch {
    return [];
  }
}

export function getBuiltInPublicImportSources() {
  return BUILT_IN_PUBLIC_IMPORT_SOURCES;
}

export function validateAutoImportSourceInput(input: AutoImportSourceInput) {
  const name = readTrimmedString(input.name);
  const url = normalizeExternalUrl(readTrimmedString(input.url));
  const city = readTrimmedString(input.city);
  const state = readTrimmedString(input.state)?.toUpperCase();
  const organizerName = readTrimmedString(input.organizerName);
  const categories = normalizeCategories(input.categories);
  const facebookUrl = normalizeExternalUrl(readTrimmedString(input.facebookUrl)) ?? undefined;
  const active = input.active !== false;

  if (!name) {
    return { error: "Name is required." as const };
  }

  if (!url) {
    return { error: "A valid public URL is required." as const };
  }

  if (state && state.length !== 2) {
    return { error: "State must be a 2-letter code." as const };
  }

  return {
    value: {
      name,
      url,
      city,
      state,
      organizerName,
      categories,
      facebookUrl,
      active,
    },
  };
}

export async function getDatabaseAutoImportSources() {
  let rows;
  try {
    rows = await db.autoImportSource.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    });
  } catch (error) {
    if (isMissingAutoImportSourceTableError(error)) {
      console.warn("[auto-import] AutoImportSource table is missing; returning no managed sources.");
      return [];
    }
    throw error;
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    organizerName: row.organizerName ?? undefined,
    categories: row.categories,
    facebookUrl: row.facebookUrl ?? undefined,
    active: row.active,
    origin: "database" as const,
  }));
}

export async function getAllPublicImportSources() {
  const databaseSources = await getDatabaseAutoImportSources();
  const builtInSources = getBuiltInPublicImportSources();
  const environmentSources = parsePublicImportSources();

  const merged = new Map<string, PublicImportSource>();

  for (const source of builtInSources) {
    merged.set(source.url.toLowerCase(), source);
  }

  for (const source of environmentSources) {
    merged.set(source.url.toLowerCase(), source);
  }

  for (const source of databaseSources) {
    merged.set(source.url.toLowerCase(), source);
  }

  return [...merged.values()].filter((source) => source.active !== false);
}
