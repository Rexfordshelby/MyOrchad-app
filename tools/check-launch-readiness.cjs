const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const checks = [
  {
    name: "App JavaScript syntax",
    command: [process.execPath, "--check", "app.js"],
  },
  {
    name: "UI contract checker syntax",
    command: [process.execPath, "--check", "tools/check-ui-contract.cjs"],
  },
  {
    name: "Supabase checker syntax",
    command: [process.execPath, "--check", "tools/check-supabase-readiness.cjs"],
  },
  {
    name: "Schema contract checker syntax",
    command: [process.execPath, "--check", "tools/check-schema-contract.cjs"],
  },
  {
    name: "Browser smoke checker syntax",
    command: [process.execPath, "--check", "tools/check-browser-smoke.cjs"],
  },
  {
    name: "Frontend UI contract",
    command: [process.execPath, "tools/check-ui-contract.cjs"],
  },
  {
    name: "Rendered app browser smoke",
    command: [process.execPath, "tools/check-browser-smoke.cjs"],
  },
  {
    name: "Local Supabase schema contract",
    command: [process.execPath, "tools/check-schema-contract.cjs"],
  },
  {
    name: "Live Supabase schema",
    command: [process.execPath, "tools/check-supabase-readiness.cjs"],
    requiredAction: "Run supabase/schema.sql in the Supabase SQL editor, then rerun this launch check.",
  },
];

function runCheck(check) {
  console.log(`\n== ${check.name} ==`);
  const [cmd, ...args] = check.command;
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const passed = result.status === 0;
  console.log(passed ? `[PASS] ${check.name}` : `[FAIL] ${check.name}`);
  if (!passed && check.requiredAction) console.log(`Next action: ${check.requiredAction}`);
  return { ...check, passed, status: result.status };
}

const results = checks.map(runCheck);
const failures = results.filter((result) => !result.passed);

console.log("\n== Launch readiness summary ==");
for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} - ${result.name}`);
}

if (failures.length) {
  console.log("");
  console.log("Launch is not ready yet. Fix the failed checks above before presenting the app as production-ready.");
  process.exit(1);
}

console.log("");
console.log("Launch readiness passed. The app contract and live Supabase schema are ready.");
