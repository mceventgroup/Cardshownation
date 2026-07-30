import { spawn } from "node:child_process";

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("npm_execpath is unavailable; start E2E through an npm script.");
}

const child = spawn(
  process.execPath,
  [
    npmCli,
    "run",
    "dev",
    "--workspace",
    "@csn/web",
    "--",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      CSN_DATA_MODE: "fixture",
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
    },
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
