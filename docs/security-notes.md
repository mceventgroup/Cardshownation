# Security Notes

## Next.js / PostCSS audit exception

As of 2026-06-10, the actionable dependency vulnerabilities in this repo were addressed by upgrading:

- `next` to `15.5.19`
- `ws` to `8.21.0`
- `turbo` to `2.9.18`

Local verification showed that the remaining `npm audit` finding is tied to `next` bundling `postcss@8.4.31` as a nested dependency.

Important context:

- This is currently upstream to this repo rather than caused by a directly pinned local dependency.
- At the time of verification, the published `next@16.2.9` package still declared `postcss: 8.4.31`.
- Because of that, a normal Next.js upgrade path did not provide a clean local remediation for this remaining audit result.

Current policy for this repo:

1. Keep `next` on the latest stable patch/minor version compatible with the app.
2. Re-run `npm audit` whenever:
   - a new `15.x` or `16.x` Next.js release is published
   - Dependabot opens a framework/dependency PR
   - routine dependency maintenance is performed
3. Do not use `npm audit fix --force` for this issue.
4. Do not hand-edit `node_modules` or use unsupported local patching of the published Next.js package to silence the audit output.

References:

- PostCSS advisory: <https://github.com/advisories/GHSA-qx2v-qp2m-jg93>
- Next.js releases: <https://github.com/vercel/next.js/releases>
- Next npm package: <https://www.npmjs.com/package/next>
