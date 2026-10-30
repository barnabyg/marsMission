// The one command for playing the game: installs what's needed, builds it and opens it.
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";

const installMarker = "node_modules/.package-lock.json";

function run(command) {
  // shell: true resolves npm and npx on Windows, where they are .cmd shims.
  const result = spawnSync(command, { stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const installed =
  existsSync(installMarker) &&
  statSync(installMarker).mtimeMs >= statSync("package-lock.json").mtimeMs;

if (!installed) run("npm ci");
run("npx vite build --logLevel warn");
run("npx vite preview --open");
