# Hosting Notes

Current decision: stay on `Vercel + Neon` for now so beta work can keep moving.

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
