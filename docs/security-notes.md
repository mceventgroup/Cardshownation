# Security Notes

## Next.js / PostCSS audit history

As of 2026-08-30, the production PostCSS audit finding was cleared by upgrading Next.js to the first compatible package set that no longer installs `next -> postcss@8.4.31`.

Important context:

- The earlier 2026-06-17 audit finding was upstream to this repo rather than caused by a directly pinned local dependency.
- At that time, the available Next.js package still declared `postcss: 8.4.31`.
- The 2026-08-30 package set resolves `next -> postcss@8.5.23` and keeps the app-level `postcss` override above the vulnerable range.

Current policy for this repo:

1. Keep `next` on the latest stable patch/minor version compatible with the app.
2. Re-run `npm audit` whenever:
   - a new `15.x` or `16.x` Next.js release is published
   - Dependabot opens a framework/dependency PR
   - routine dependency maintenance is performed
3. Do not use `npm audit fix --force` without validating lint, typecheck, tests, and production build.
4. Do not hand-edit `node_modules` or use unsupported local patching of the published Next.js package to silence the audit output.

References:

- PostCSS advisory: <https://github.com/advisories/GHSA-qx2v-qp2m-jg93>
- Next.js releases: <https://github.com/vercel/next.js/releases>
- Next npm package: <https://www.npmjs.com/package/next>

## Remote fetch DNS-rebinding mitigation

`apps/web/lib/safe-remote-fetch.ts` is used for untrusted remote imports such as external flyer URLs. It currently:

- normalizes input to `http` or `https`
- blocks localhost, metadata hostnames, `.local`, and `.internal`
- resolves the hostname with DNS before the request
- rejects private, loopback, link-local, reserved, multicast, and similar addresses
- rejects redirects
- limits response size at the caller

Address pinning was reviewed on 2026-08-30. The standard `fetch` API available in the existing Next.js/Vercel runtime does not provide reliable per-request socket address pinning. Forcing a custom `undici` dispatcher or lower-level HTTP client would be brittle in serverless deployment and could break valid remote imports, IPv6, CDN rotation, and managed runtime behavior.

The safest practical mitigation in this environment is to keep DNS preflight validation, reject redirects, keep strict host/address deny rules, constrain size and content handling at import call sites, and avoid using fetched bytes as executable content. If remote import risk increases later, revisit this with an isolated ingestion worker or storage proxy where DNS resolution and the outbound socket can be pinned and audited together.
