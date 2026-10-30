// The canonical, non-mutating verification command. Gates run in order and stop at the first failure.
// Warning output counts as failure even when a tool exits successfully.
import { spawn } from "node:child_process";

const gates = [
  ["Formatting", "npx prettier --check ."],
  ["Lint", "npx eslint . --max-warnings=0"],
  [
    "Types",
    "npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.simulation.json --noEmit",
  ],
  ["Static analysis (unused code and dependencies)", "npx knip"],
  ["Unit tests", "npx vitest run"],
  ["Browser tests", "npx playwright test"],
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

console.log("\nAll verification gates passed.");
