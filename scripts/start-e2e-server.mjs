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

let shuttingDown = false;

function stopChild(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    killer.on("exit", () => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
    return;
  }

  child.kill(signal);
  setTimeout(() => process.exit(0), 5_000).unref();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stopChild(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
