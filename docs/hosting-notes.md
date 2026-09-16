# Hosting Notes

Current decision: stay on `Vercel + Neon` for now so beta work can keep moving.

Homepage location detection uses a saved state first, then a server-side GeoJS
lookup of the visitor IP, then Vercel's US state header if the lookup fails.
Automatic results are statewide; device-location searches retain their radius.
GeoJS requires no API key. Requests have a 1.2-second timeout, use no persistent
fetch cache, and share a bounded in-memory cache of hashed IP keys/state results
for up to 15 minutes (30 seconds for failures). No raw IP is intentionally logged.
Provider documentation: https://www.geojs.io/docs/v1/endpoints/geo/

Cloudflare proxies the production domain in front of Vercel. Vercel's incoming
IP and geo headers can therefore describe a Cloudflare server, not the visitor.
`getRequestIp` reads `CF-Connecting-IP` only when the Vercel-reported peer belongs
to Cloudflare's published IPv4/IPv6 networks. Direct requests ignore that header.
If the independent lookup fails on a proxied request, show the nationwide fallback
instead of using the proxy's state. Proxy ranges: https://www.cloudflare.com/ips/

Portability prep already completed:

- Prisma now uses a true singleton pattern in `apps/web/lib/db.ts`
- Next.js build now uses `output: "standalone"` in `apps/web/next.config.js`
- Flyer storage is isolated behind `apps/web/lib/flyer-storage.ts`

Deferred infrastructure follow-up when it becomes worth moving:

1. Move floorplanner cloud save off direct Neon access in `apps/web/floorplanner/lib/server/cloud-layout-store.ts`
2. Replace Vercel Blob-backed flyer storage with DigitalOcean Spaces or another provider-neutral object store
3. Add a shared API auth resolver that supports both browser cookies and future mobile bearer tokens
4. Revisit a split between public pages and stateful app routes if traffic or Neon limits start hurting beta

Signals that mean it is time to move:

- Neon compute throttling becomes frequent
- auth, admin, imports, or floorplanner become unstable under normal use
- Vercel serverless request behavior starts causing noticeable latency or connection issues
- monthly Vercel + Neon cost gets close to a persistent-hosting alternative
- mobile app work becomes active
