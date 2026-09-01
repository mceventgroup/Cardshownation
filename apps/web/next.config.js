/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "sharp",
  ],
  images: {
    // Flyer uploads are normalized to web-ready WebP before storage. Serving
    // those assets directly avoids sending untrusted image bytes through the
    // version of Sharp bundled internally by Next.js.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), browsing-topics=()",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },
        ],
      },
      ...[
        "/account/:path*",
        "/admin/:path*",
        "/moderator/:path*",
        "/promoter/:path*",
        "/floorplanner/billing",
        "/floorplanner/workspace",
        "/api/floorplanner/:path*",
      ].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      })),
    ];
  },
  webpack: (config, { isServer, dev }) => {
    if (dev && process.platform === "win32") {
      config.cache = false;
    }

    if (isServer && Array.isArray(config.externals)) {
      config.externals = [...config.externals, { canvas: "canvas" }];
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    return config;
  },
};

module.exports = nextConfig;
