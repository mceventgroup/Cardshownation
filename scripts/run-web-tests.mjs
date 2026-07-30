import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = join(repoRoot, "apps", "web");

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === ".next") return [];

    const pathname = join(directory, entry.name);
    if (entry.isDirectory()) return findTests(pathname);
    if (!entry.isFile() || !/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    return [relative(repoRoot, pathname)];
  });
}

const tests = findTests(webRoot).sort();
if (tests.length === 0) {
  console.error("No web tests were found.");
  process.exit(1);
}

console.log(`Running ${tests.length} web test files.`);
const tsxCli = resolve(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
const result = spawnSync(
  process.execPath,
  [tsxCli, "--tsconfig", "apps/web/tsconfig.json", "--test", ...tests],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  },
);

process.exit(result.status ?? 1);
