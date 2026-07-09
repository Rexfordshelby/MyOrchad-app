const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const schemaSql = fs.readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
const postMigrationSqlPath = path.join(root, "supabase", "post-migration-check.sql");
const postMigrationSql = fs.existsSync(postMigrationSqlPath) ? fs.readFileSync(postMigrationSqlPath, "utf8") : "";

const failures = [];
const report = [];

function fail(message, detail = "") {
  failures.push(detail ? `${message}: ${detail}` : message);
}

function ensure(condition, message, detail = "") {
  if (!condition) fail(message, detail);
}

function unique(values) {
  return [...new Set(values)].sort();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractRequiredSchema() {
  const block = appJs.match(/const requiredSupabaseSchema\s*=\s*\{([\s\S]*?)\};/)?.[1] || "";
  const entries = {};
  for (const match of block.matchAll(/^\s*([a-z_]+):\s*\[([^\]]*)\]/gm)) {
    entries[match[1]] = unique([...match[2].matchAll(/"([^"]+)"/g)].map((column) => column[1]));
  }
  return entries;
}

function tableDefinition(table) {
  const regex = new RegExp(`create table if not exists public\\.${escapeRegex(table)}\\s*\\(([\\s\\S]*?)\\n\\);`, "i");
  return schemaSql.match(regex)?.[1] || "";
}

function hasColumnInTableDefinition(table, column) {
  const definition = tableDefinition(table);
  const columnRegex = new RegExp(`(^|\\n)\\s*${escapeRegex(column)}\\s+`, "i");
  return columnRegex.test(definition);
}

function hasAlterColumn(table, column) {
  const regex = new RegExp(`alter table public\\.${escapeRegex(table)} add column if not exists ${escapeRegex(column)}\\s+`, "i");
  return regex.test(schemaSql);
}

const requiredSchema = extractRequiredSchema();
const requiredTables = Object.keys(requiredSchema);

ensure(requiredTables.length > 0, "Could not read requiredSupabaseSchema from app.js");

for (const table of requiredTables) {
  ensure(
    new RegExp(`create table if not exists public\\.${escapeRegex(table)}\\b`, "i").test(schemaSql),
    "Required table is not created by schema.sql",
    table,
  );
  ensure(
    new RegExp(`alter table public\\.${escapeRegex(table)} enable row level security`, "i").test(schemaSql),
    "Required table does not enable RLS",
    table,
  );

  for (const column of requiredSchema[table]) {
    ensure(
      hasColumnInTableDefinition(table, column) || hasAlterColumn(table, column),
      "Required app column missing from schema.sql",
      `${table}.${column}`,
    );
  }
}
report.push(`Required app tables checked: ${requiredTables.length}`);

const adminEmails = [
  "raashifshaikh70@gmail.com",
  "admin@myorchard.app",
  "admin@kalpavrikshaagro.com",
  "team@kalpavrikshaagro.com",
];
for (const email of adminEmails) {
  ensure(schemaSql.includes(`('${email}')`), "Admin seed email missing", email);
}
ensure(/create policy "users can check own admin email"/i.test(schemaSql), "Admin email lookup policy missing");
ensure(/role <> 'admin'[\s\S]*public\.app_admins/i.test(schemaSql), "Admin profile writes must require app_admins allowlist");
report.push(`Admin seed and gate checked: ${adminEmails.length} emails`);

const policyNames = [
  "users can read own profile",
  "users can insert own profile",
  "users can update own profile",
  "public can read orchards",
  "admins can manage orchards",
  "users can read own verifications or admins read all",
  "farmers can insert own verification",
  "farmers can update pending own verification",
  "admins can update verifications",
  "public can read farmer updates",
  "farmers can insert own updates",
  "users can read own adoptions or admins read all",
  "farmers can read orchard adoptions",
  "supporters can insert own adoptions",
  "public can read program settings",
  "admins can manage program settings",
];
for (const policy of policyNames) {
  ensure(
    new RegExp(`create policy "${escapeRegex(policy)}"`, "i").test(schemaSql),
    "Expected RLS policy missing",
    policy,
  );
}
ensure(/p\.role = 'farmer'/i.test(schemaSql), "Farmer write policies must verify farmer role");
ensure(/p\.role = 'supporter'/i.test(schemaSql), "Adoption write policy must verify supporter role");
ensure(/auth\.uid\(\) = user_id/i.test(schemaSql), "User-owned writes must bind records to auth.uid()");
report.push(`RLS policies checked: ${policyNames.length}`);

const backendGuards = [
  ["Certificate unique index", /create unique index if not exists adoptions_certificate_id_key/i],
  ["Certificate index ignores null IDs", /where certificate_id is not null/i],
  ["Inventory check function", /create or replace function public\.ensure_adoption_inventory/i],
  ["Inventory update function", /create or replace function public\.apply_adoption_inventory/i],
  ["Inventory lock", /for update/i],
  ["Insufficient inventory rejection", /current_available < new\.tree_count/i],
  ["Before-insert inventory trigger", /before insert on public\.adoptions/i],
  ["After-insert inventory trigger", /after insert on public\.adoptions/i],
  ["Orchard slug uniqueness", /create unique index if not exists orchards_slug_key/i],
  ["Verification duplicate guard", /create unique index if not exists verifications_farm_farmer_key/i],
];
for (const [label, regex] of backendGuards) {
  ensure(regex.test(schemaSql), "Backend guard missing", label);
}
report.push(`Backend guards checked: ${backendGuards.length}`);

ensure(postMigrationSql.length > 0, "Supabase post-migration check SQL is missing", "supabase/post-migration-check.sql");
for (const table of requiredTables) {
  ensure(postMigrationSql.includes(`('${table}')`), "Post-migration check does not cover required table", table);
}
for (const email of adminEmails) {
  ensure(postMigrationSql.includes(`('${email}')`), "Post-migration check does not cover admin seed", email);
}
const postMigrationSections = ["tables", "columns", "admin seed", "rls", "policies", "triggers", "indexes"];
for (const section of postMigrationSections) {
  ensure(postMigrationSql.includes(`'${section}' as section`), "Post-migration check section missing", section);
}
ensure(/Every returned row should have ok = true\./.test(postMigrationSql), "Post-migration check must state the success condition");
report.push(`Post-migration SQL check covered: ${postMigrationSections.length} sections`);

const output = [
  "MyOrchard local schema contract check",
  "",
  ...report.map((line) => `[OK] ${line}`),
];

if (failures.length) {
  output.push("", "Failures:");
  failures.forEach((failure) => output.push(`- ${failure}`));
  console.error(output.join("\n"));
  process.exit(1);
}

output.push("", "schema.sql matches the app contract, admin seed, RLS policies, and adoption/certificate safeguards.");
console.log(output.join("\n"));
