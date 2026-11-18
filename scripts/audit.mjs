import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Remove this exception when a published release fixes GHSA-fc5q-39xc-vjpf.
// These installations are only used by development tools, with repository-owned glob patterns.
const picomatchAdvisory = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";

const audit = spawnSync(
  "npm audit --json --audit-level=low --fetch-retries=1 --fetch-timeout=30000",
  { shell: true, encoding: "utf8", timeout: 180_000 },
);
if (audit.stderr) process.stderr.write(audit.stderr);
if (audit.error) throw audit.error;
if (audit.status === 0) {
  console.log("npm audit found no vulnerabilities at low severity or above.");
  process.exit(0);
}

const { vulnerabilities, error } = JSON.parse(audit.stdout);
if (audit.status !== 1 || error || !vulnerabilities) {
  console.error(audit.stdout);
  process.exit(1);
}

const { packages } = JSON.parse(readFileSync("package-lock.json", "utf8"));
const affectedPaths = vulnerabilities.picomatch?.nodes ?? [];
const devOnlyPicomatch =
  affectedPaths.length > 0 &&
  affectedPaths.every(
    (path) =>
      packages[path]?.dev === true && packages[path].version === "4.0.7",
  );

const findings = Object.values(vulnerabilities);
const advisories = findings.flatMap(({ via }) =>
  via.filter((cause) => typeof cause !== "string"),
);
const onlyReportedAdvisoryIsExcepted =
  advisories.length > 0 &&
  advisories.every(
    ({ name, url }) => name === "picomatch" && url === picomatchAdvisory,
  ) &&
  findings.every(
    ({ via }) =>
      via.length > 0 &&
      via.every(
        (cause) =>
          typeof cause !== "string" || Object.hasOwn(vulnerabilities, cause),
      ),
  );

if (devOnlyPicomatch && onlyReportedAdvisoryIsExcepted) {
  console.log(
    "npm audit passed with the documented temporary dev-only picomatch exception (GHSA-fc5q-39xc-vjpf).",
  );
} else {
  console.error(audit.stdout);
  process.exitCode = 1;
}
