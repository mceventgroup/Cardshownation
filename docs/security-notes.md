# Security Notes

## Next.js / PostCSS audit exception

As of 2026-06-17, the remaining production audit finding in this repo is still tied to `next` bundling `postcss@8.4.31` as a nested dependency.

Important context:

- This is currently upstream to this repo rather than caused by a directly pinned local dependency.
- Local verification showed:
  - `npm audit --omit=dev` reports `GHSA-qx2v-qp2m-jg93`
  - `npm ls postcss next` still resolves `next@15.5.18 -> postcss@8.4.31`
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
