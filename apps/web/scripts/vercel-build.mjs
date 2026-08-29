import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const env = { ...process.env };
const migrationDatabaseUrl =
  env.DIRECT_URL?.trim() ||
  env.DATABASE_URL_UNPOOLED?.trim() ||
  env.POSTGRES_URL_NON_POOLING?.trim() ||
  env.DATABASE_URL?.trim();

if (!migrationDatabaseUrl) {
  console.error("A production database URL is required before migrations can run.");
  process.exit(1);
}

env.DIRECT_URL = migrationDatabaseUrl;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

run(npxCommand, [
  "prisma",
  "migrate",
  "deploy",
  "--schema=../../packages/db/prisma/schema.prisma",
]);
run(npmCommand, ["run", "build"]);
