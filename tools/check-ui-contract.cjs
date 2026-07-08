const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const appJs = read("app.js");
const readme = read("README.md");
const schemaSql = read("supabase/schema.sql");

function unique(values) {
  return [...new Set(values)].sort();
}

function matches(source, regex) {
  return unique([...source.matchAll(regex)].map((match) => match[1]).filter(Boolean));
}

function fail(message, detail = "") {
  failures.push(detail ? `${message}: ${detail}` : message);
}

function ensure(condition, message, detail = "") {
  if (!condition) fail(message, detail);
}

const failures = [];
const report = [];

const visibleActions = matches(appJs, /data-action=["']([^"']+)["']/g);
const handledActions = matches(appJs, /action\s*===\s*["']([^"']+)["']/g);
const missingActionHandlers = visibleActions.filter((action) => !handledActions.includes(action));
const unusedActionHandlers = handledActions.filter((action) => !visibleActions.includes(action));

ensure(!missingActionHandlers.length, "Visible data-action values need click handlers", missingActionHandlers.join(", "));
report.push(`Actions rendered: ${visibleActions.length}`);
report.push(`Actions handled: ${handledActions.length}`);
if (unusedActionHandlers.length) report.push(`Handlers without visible controls: ${unusedActionHandlers.join(", ")}`);

const visibleExports = matches(appJs, /data-export=["']([^"']+)["']/g);
const handledExports = matches(appJs, /type\s*===\s*["']([^"']+)["']/g);
const missingExportHandlers = visibleExports.filter((exportType) => !handledExports.includes(exportType));
ensure(!missingExportHandlers.length, "Visible export buttons need exportCsv handlers", missingExportHandlers.join(", "));
report.push(`Export types checked: ${visibleExports.length}`);

const adminEmail = "raashifshaikh70@gmail.com";
ensure(appJs.includes(adminEmail), "Admin email missing from frontend allowlist", adminEmail);
ensure(schemaSql.includes(`('${adminEmail}')`), "Admin email missing from Supabase app_admins seed", adminEmail);
ensure(readme.includes(adminEmail), "Admin email missing from README access notes", adminEmail);
ensure(/function hasAdminAccess\(\)[\s\S]*state\.role === "admin"[\s\S]*state\.session\?\.role === "admin"[\s\S]*isAdminEmail\(state\.session\.email\)/.test(appJs), "Admin gate must require admin role, admin session role, and approved email");
ensure(/else if \(hasAdminAccess\(\)\)[\s\S]*renderTopbar\("Admin"\) \+ renderAdmin\(\)/.test(appJs), "Admin screen should only render behind hasAdminAccess()");
ensure(!/data-role=["']admin["'][\s\S]{0,160}choose-role/.test(appJs), "Welcome role picker must not expose admin as a public role");
ensure(/profileSyncWarning[\s\S]*profile sync needs backend attention/.test(appJs), "Profile sync failures should be visible after sign-in");
report.push("Admin gate checked");

ensure(/data-action=["']language["'][\s\S]*data-lang=["']en["']/.test(appJs), "English language switch is missing");
ensure(/data-action=["']language["'][\s\S]*data-lang=["']mr["']/.test(appJs), "Marathi language switch is missing");
ensure(/preferred_language/.test(appJs), "Preferred language should be persisted through Supabase profile fields");
ensure(/const mrText\s*=\s*\{[\s\S]*"MyOrchard app":/.test(appJs), "Marathi translation map is missing");
report.push("Language switch checked");

const requiredTables = matches(appJs, /requiredSupabaseSchema\s*=\s*\{([\s\S]*?)\};/g)[0]
  ? matches(appJs.match(/requiredSupabaseSchema\s*=\s*\{([\s\S]*?)\};/)?.[1] || "", /^\s*([a-z_]+):/gm)
  : [];
for (const table of requiredTables) {
  ensure(schemaSql.includes(`public.${table}`), "Required Supabase table missing from schema.sql", table);
}
report.push(`Supabase contract tables checked: ${requiredTables.length}`);

const productionFiles = ["app.js", "index.html", "styles.css", "README.md", "supabase/schema.sql"];
const bannedProductionWords = /\b(mock|fake|demo|sample|lorem|todo|fixme)\b/i;
for (const file of productionFiles) {
  const content = read(file);
  const badLine = content.split(/\r?\n/).find((line) => bannedProductionWords.test(line));
  ensure(!badLine, "Production-facing file contains mock/demo marker", `${file}: ${badLine || ""}`.trim());
}
report.push("Production copy checked for mock/demo markers");

const output = [
  "MyOrchard UI contract check",
  "",
  ...report.map((line) => `[OK] ${line}`),
];

if (failures.length) {
  output.push("", "Failures:");
  failures.forEach((failure) => output.push(`- ${failure}`));
  console.error(output.join("\n"));
  process.exit(1);
}

output.push("", "UI contract looks ready: visible buttons have handlers, exports are wired, admin access is gated, and Marathi/admin/backend contracts are present.");
console.log(output.join("\n"));
