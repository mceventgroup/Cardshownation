import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://cardshownation.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account",
          "/admin",
          "/api/",
          "/card-shows?*",
          "/floorplanner/billing",
          "/floorplanner/workspace",
          "/moderator",
          "/promoter",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
