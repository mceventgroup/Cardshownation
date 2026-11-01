import { unstable_cache, revalidateTag } from "next/cache";
import { isFixtureMode } from "@/lib/data-mode";

const PUBLIC_DIRECTORY_TAG = "public-show-directory-v1";

// Cache query results only: sessions, cookies and personalized HTML stay outside.
export function cachePublicDirectoryQuery<Args extends unknown[], Result>(
  name: string,
  query: (...args: Args) => Promise<Result>,
) {
  const cached = unstable_cache(
    async (_day: string, ...args: Args) => query(...args),
    [PUBLIC_DIRECTORY_TAG, name],
    { revalidate: 300, tags: [PUBLIC_DIRECTORY_TAG] },
  );
  return (...args: Args) => isFixtureMode()
    ? query(...args)
    : cached(new Date().toISOString().slice(0, 10), ...args);
}

export function invalidatePublicDirectory() {
  if (!isFixtureMode()) revalidateTag(PUBLIC_DIRECTORY_TAG, { expire: 0 });
}
