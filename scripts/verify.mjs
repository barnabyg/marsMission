// The canonical, non-mutating verification command. Gates run in order and stop at the first failure.
// Warning output counts as failure even when a tool exits successfully.
import { spawn } from "node:child_process";

// CI splits the gates across jobs: one runs every gate but the browser tests, and the browser tests run in shards,
// each in a job of its own. With no options, every gate runs, as it does locally.
//   --without-browser-tests      every gate but the browser tests
//   --browser-tests-only         only the browser tests
//   --shard=N/M                  with the browser tests, only the Nth of M equal parts of them
const args = process.argv.slice(2);
const known =
  /^(--without-browser-tests|--browser-tests-only|--shard=\d+\/\d+)$/;
const unknown = args.filter((arg) => !known.test(arg));
if (unknown.length > 0) {
  console.error(`Unknown option: ${unknown.join(" ")}`);
  process.exit(1);
}
const withoutBrowserTests = args.includes("--without-browser-tests");
const browserTestsOnly = args.includes("--browser-tests-only");
const shard = args.find((arg) => arg.startsWith("--shard="));
if (withoutBrowserTests && (browserTestsOnly || shard)) {
  console.error(
    "--without-browser-tests can't be used with the browser test options.",
  );
  process.exit(1);
}

const browserGate = "Browser tests";

const allGates = [
  ["Formatting", "npx prettier --check ."],
  ["Lint", "npx eslint . --max-warnings=0"],
  [
    "Types",
    "npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.simulation.json --noEmit",
  ],
  ["Static analysis (unused code and dependencies)", "npx knip"],
  ["Unit tests", "npx vitest run"],
  [browserGate, `npx playwright test${shard ? ` ${shard}` : ""}`],
  ["Dependency tree", "npm ls --all --silent"],
  ["Vulnerabilities", "npm audit --audit-level=low"],
  ["Secrets", "npm run secrets --silent"],
  [
    "Build",
    "npx vite build --outDir node_modules/.cache/verify-build --emptyOutDir",
  ],
];

const warningPattern = /\bwarn(ing)?s?\b/i;

// The development server echoes the browser's console. This is the one warning e2e/helpers.ts
// also allows, for the same reason: it comes from inside @react-three/fiber 9.8.2. Remove it with
// that exception.
const allowedWarning = "THREE.Clock: This module has been deprecated";

function runGate(command) {
  return new Promise((resolve) => {
    // shell: true resolves npm and npx on Windows, where they are .cmd shims.
    const child = spawn(command, {
      shell: true,
      env: { ...process.env, CI: "true" },
    });
    const warnings = [];
    const onData = (stream) => (chunk) => {
      stream.write(chunk);
      for (const line of chunk.toString().split("\n")) {
        if (warningPattern.test(line) && !line.includes(allowedWarning)) {
          warnings.push(line.trim());
        }
      }
    };
    child.stdout.on("data", onData(process.stdout));
    child.stderr.on("data", onData(process.stderr));
    child.on("close", (status) => {
      resolve({ status, warnings });
    });
  });
}

const gates = allGates.filter(([name]) =>
  browserTestsOnly
    ? name === browserGate
    : !(withoutBrowserTests && name === browserGate),
);

for (const [name, command] of gates) {
  console.log(`\n=== ${name} ===`);
  const { status, warnings } = await runGate(command);
  if (status !== 0) {
    console.error(`\nFAILED: ${name} (exit code ${status})`);
    process.exit(1);
  }
  if (warnings.length > 0) {
    console.error(`\nFAILED: ${name} printed warning output:`);
    for (const warning of warnings) console.error(`  ${warning}`);
    process.exit(1);
  }
}

console.log(
  gates.length === allGates.length
    ? "\nAll verification gates passed."
    : `\nThese verification gates passed: ${gates.map(([name]) => name).join(", ")}.`,
);
