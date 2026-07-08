const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");

const supabaseUrl = appJs.match(/url: "([^"]+)"/)?.[1];
const publishableKey =
  appJs.match(/publishableKey: "([^"]+)"/)?.[1] ||
  appJs.match(/anonKey:\s*\n\s*"([^"]+)"/)?.[1];

if (!supabaseUrl || !publishableKey) {
  console.error("Could not read Supabase URL/key from app.js.");
  process.exit(1);
}

const required = {
  app_admins: ["email", "created_at"],
  user_profiles: ["user_id", "email", "full_name", "role", "preferred_language", "updated_at"],
  orchards: [
    "slug",
    "name",
    "farmer_name",
    "district",
    "village",
    "total_trees",
    "adopted_trees",
    "available_trees",
    "farmer_income",
  ],
  verifications: [
    "id",
    "user_id",
    "farmer_name",
    "farm_name",
    "district",
    "village",
    "acres",
    "crop",
    "status",
    "total_trees",
    "updated_at",
  ],
  farmer_updates: ["id", "user_id", "orchard_slug", "title", "body", "photo_names", "created_at"],
  adoptions: [
    "id",
    "user_id",
    "supporter_name",
    "supporter_mobile",
    "orchard_slug",
    "tree_count",
    "total_amount",
    "payment_method",
    "payment_status",
    "certificate_id",
    "created_at",
  ],
  program_settings: [
    "id",
    "adoption_amount",
    "crop_focus",
    "verification_requirement",
    "update_frequency",
    "launch_districts",
    "updated_by",
    "updated_at",
  ],
};

async function requestTable(table, select = "*") {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    },
  });
  const body = await response.text();
  return {
    table,
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function inspectTable(table, columns) {
  const tableCheck = await requestTable(table);
  if (!tableCheck.ok) {
    return {
      table,
      ok: false,
      status: tableCheck.status,
      tableMissing: true,
      missingColumns: columns,
      body: tableCheck.body,
    };
  }

  const missingColumns = [];
  const errors = [];
  for (const column of columns) {
    const columnCheck = await requestTable(table, column);
    if (columnCheck.ok) continue;
    missingColumns.push(column);
    errors.push(columnCheck.body);
  }

  return {
    table,
    ok: missingColumns.length === 0,
    status: missingColumns.length ? 400 : 200,
    tableMissing: false,
    missingColumns,
    body: errors[0] || tableCheck.body,
  };
}

async function main() {
  const results = [];
  for (const [table, columns] of Object.entries(required)) {
    results.push(await inspectTable(table, columns));
  }

  let failed = false;
  console.log("MyOrchard Supabase readiness check");
  console.log(`Project: ${supabaseUrl}`);
  console.log("");

  for (const result of results) {
    if (result.ok) {
      console.log(`[OK] ${result.table}`);
      continue;
    }
    failed = true;
    let message = result.body;
    try {
      const parsed = JSON.parse(result.body);
      message = parsed.message || parsed.hint || result.body;
    } catch {
      // Keep original body.
    }
    if (result.tableMissing) {
      console.log(`[MISSING] ${result.table} (${result.status}) ${message}`);
    } else {
      console.log(`[MISSING] ${result.table} columns: ${result.missingColumns.join(", ")}`);
    }
  }

  if (failed) {
    console.log("");
    console.log("Run supabase/schema.sql in the Supabase SQL editor, then run this check again.");
    process.exit(1);
  }

  console.log("");
  console.log("Supabase schema is ready for the MyOrchard UI.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
