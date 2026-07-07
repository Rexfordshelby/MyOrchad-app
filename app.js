const assets = {
  cover: "assets/cover.png",
  farmer: "assets/farmer-onboarding.png",
  supporter: "assets/supporter.png",
  trust: "assets/trust.png",
  adoption: "assets/adoption-process.png",
  admin: "assets/admin.png",
  revenue: "assets/revenue.png",
};

const programConfig = {
  adoptionAmount: 5000,
};

const supabaseConfig = {
  url: "https://kbrpjigxqchldjnjyuem.supabase.co",
  publishableKey: "sb_publishable_MS2gZ9VOqi5Vs2-KfXpH3g_Mc8uKc9i",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticnBqaWd4cWNobGRqbmp5dWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTUyMzAsImV4cCI6MjA5ODk3MTIzMH0.fp2yqR1Ba0YFxT8WWDzXA92FrGoi7f1EeuwxToo9VVg",
  projectRef: "kbrpjigxqchldjnjyuem",
};

const supabaseBridge = {
  client: null,
  status: "loading",
  dataSource: "Connecting",
  lastSync: "",
  message: "Connecting to secure MyOrchard records.",
  init() {
    const supabaseGlobal = typeof supabase !== "undefined" ? supabase : null;
    const supabaseFactory = window.supabase?.createClient || globalThis.supabase?.createClient || supabaseGlobal?.createClient;
    if (!supabaseFactory) return;

    this.client = supabaseFactory(supabaseConfig.url, supabaseConfig.publishableKey || supabaseConfig.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    this.status = "connected";
    this.dataSource = "Supabase ready";
    this.message = "Reading verified orchard records from Supabase.";
  },
  async sync() {
    if (!this.client) return false;

    const [orchardRows, verificationRows, updateRows] = await Promise.all([
      this.readTable("orchards"),
      this.readTable("verifications"),
      this.readTable("farmer_updates"),
    ]);

    let loaded = false;

    const liveOrchardRows = orchardRows?.filter((row) => !seedRecordIds.has(String(firstValue(row, ["slug", "id", "orchard_id"], "")).toLowerCase())) || [];
    const liveVerificationRows =
      verificationRows?.filter((row) => {
        const id = String(firstValue(row, ["slug", "farm_slug", "orchard_id"], "")).toLowerCase();
        const farm = String(firstValue(row, ["farm", "farm_name", "orchard_name"], "")).toLowerCase();
        return !seedRecordIds.has(id) && !seedFarmNames.has(farm);
      }) || [];

    if (liveOrchardRows.length) {
      orchards.splice(0, orchards.length, ...liveOrchardRows.map(mapSupabaseOrchard));
      loaded = true;
    }

    if (liveVerificationRows.length) {
      state.verifications = liveVerificationRows.map(mapSupabaseVerification);
      loaded = true;
    }

    if (updateRows?.length && liveOrchardRows.length) {
      state.farmerUpdates = updateRows.map(mapSupabaseUpdate);
      loaded = true;
    }

    this.lastSync = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (loaded) {
      this.status = "live";
      this.dataSource = "Supabase live data";
      this.message = "Live Supabase rows are powering this interface.";
    } else {
      this.status = "empty";
      this.dataSource = "No published rows";
      this.message = "Supabase is connected, but no orchard records are published yet.";
    }

    return loaded;
  },
  async readTable(table) {
    try {
      const { data, error } = await this.client.from(table).select("*").limit(50);
      if (error || !Array.isArray(data)) return null;
      return data;
    } catch {
      return null;
    }
  },
};

window.MyOrchardSupabase = supabaseBridge;

const districts = ["Sindhudurg", "Ratnagiri", "Kolhapur"];

const fallbackImages = [assets.trust, assets.supporter, assets.farmer, assets.revenue];
const seedRecordIds = new Set(["patil", "kadam", "naik"]);
const seedFarmNames = new Set(["patil cashew farm", "kadam orchard", "naik cashew farm"]);

let orchards = [];

const nav = {
  farmer: [
    ["dashboard", "Dashboard", "layout-dashboard"],
    ["onboarding", "Orchard", "clipboard-check"],
    ["updates", "Updates", "camera"],
    ["profile", "Profile", "user"],
  ],
  supporter: [
    ["home", "Home", "home"],
    ["orchards", "Orchards", "tree-pine"],
    ["adoption", "My Adoption", "badge-check"],
    ["updates", "Updates", "bell"],
    ["profile", "Profile", "user"],
  ],
  admin: [
    ["dashboard", "Dashboard", "layout-dashboard"],
    ["farmers", "Farmers", "users"],
    ["orchards", "Orchards", "tree-pine"],
    ["verifications", "Verify", "shield-check"],
    ["payments", "Payments", "wallet"],
    ["reports", "Reports", "bar-chart-3"],
    ["settings", "Settings", "settings"],
  ],
};

const state = {
  role: null,
  loginEmail: "",
  loginMessage: "",
  adminEmails: [
    "admin@myorchard.app",
    "admin@kalpavrikshaagro.com",
    "team@kalpavrikshaagro.com",
    "raashifshaikh70@gmail.com",
  ],
  farmerTab: "onboarding",
  supporterTab: "home",
  adminTab: "dashboard",
  farmerStep: 0,
  farmerSubmitted: false,
  teamAccessOpen: false,
  toast: "",
  selectedFarmId: "patil",
  orchardSearch: "",
  districtFilter: "All",
  treeCount: 1,
  paymentMethod: "UPI",
  adoptionComplete: false,
  updateDraft: "",
  supporterProfile: {
    name: "Supporter",
    handle: "@myorchard",
    mobile: "Add mobile number",
    email: "Add email",
    location: "Add location",
    bio: "Complete your profile to keep certificates, adopted trees, and farm updates in one place.",
  },
  farmerProfile: {
    handle: "@yourorchard",
    location: "Add village and district",
    bio: "Complete onboarding to build a verified public profile for supporters.",
  },
  farmerForm: {
    fullName: "",
    mobile: "",
    aadhaar: "",
    district: "Sindhudurg",
    village: "",
    orchardName: "",
    acres: "",
    totalTrees: "",
    crop: "Cashew",
    ownership: "Owned",
    bank: "",
    account: "",
  },
  farmerUpdates: [],
  verifications: [],
};

const app = document.querySelector("#app");

function icon(name) {
  return `<i data-lucide="${name}" class="icon"></i>`;
}

function money(value) {
  return `Rs. ${Number(value).toLocaleString("en-IN")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function numberValue(row, keys, fallback = 0) {
  const value = Number(firstValue(row, keys, fallback));
  return Number.isFinite(value) ? value : fallback;
}

function mapSupabaseOrchard(row, index) {
  const totalTrees = numberValue(row, ["total_trees", "totalTrees", "trees"], 0);
  const adopted = numberValue(row, ["adopted", "adopted_trees", "adoptedTrees"], 0);
  const available = numberValue(row, ["available", "available_trees", "availableTrees"], Math.max(totalTrees - adopted, 0));

  return {
    id: String(firstValue(row, ["slug", "id", "orchard_id"], `farm-${index + 1}`)),
    name: String(firstValue(row, ["name", "orchard_name", "farm"], "Verified Orchard")),
    farmer: String(firstValue(row, ["farmer", "farmer_name", "owner_name"], "Registered Farmer")),
    district: String(firstValue(row, ["district"], "Sindhudurg")),
    village: String(firstValue(row, ["village"], "Konkan")),
    state: String(firstValue(row, ["state"], "Maharashtra")),
    acres: String(firstValue(row, ["acres", "land_acres"], "1.0")),
    totalTrees,
    adopted,
    available,
    rating: String(firstValue(row, ["rating"], "4.7")),
    income: numberValue(row, ["income", "farmer_income"], 0),
    image: String(firstValue(row, ["image", "image_url", "photo_url"], fallbackImages[index % fallbackImages.length])),
    coordinates: String(firstValue(row, ["coordinates", "geo", "lat_lng"], "15.9042 N, 73.8216 E")),
    summary: String(firstValue(row, ["summary", "description"], "A verified orchard connected through the MyOrchard program.")),
  };
}

function mapSupabaseVerification(row, index) {
  return {
    id: String(firstValue(row, ["id", "verification_id"], `v-${index + 1}`)),
    farmer: String(firstValue(row, ["farmer", "farmer_name"], "Registered Farmer")),
    farm: String(firstValue(row, ["farm", "farm_name", "orchard_name"], "Verified Orchard")),
    district: String(firstValue(row, ["district"], "Sindhudurg")),
    status: String(firstValue(row, ["status", "verification_status"], "Pending")),
    trees: numberValue(row, ["trees", "total_trees", "totalTrees"], 0),
  };
}

function mapSupabaseUpdate(row) {
  return {
    title: String(firstValue(row, ["title"], "Farm progress update")),
    date: String(firstValue(row, ["date", "created_at", "updated_at"], "06 Jul 2026")).slice(0, 16),
    body: String(firstValue(row, ["body", "note", "description"], "New orchard update from the farmer.")),
  };
}

function selectedFarm() {
  return orchards.find((farm) => farm.id === state.selectedFarmId) || orchards[0] || null;
}

function orchardTotals() {
  return orchards.reduce(
    (totals, farm) => {
      totals.trees += Number(farm.totalTrees) || 0;
      totals.adopted += Number(farm.adopted) || 0;
      totals.available += Number(farm.available) || 0;
      totals.income += Number(farm.income) || 0;
      return totals;
    },
    { trees: 0, adopted: 0, available: 0, income: 0 },
  );
}

function farmerTotalTrees() {
  return Number(state.farmerForm.totalTrees) || 0;
}

function farmerDisplayName() {
  return state.farmerForm.fullName.trim() || "farmer";
}

function farmerOrchardName() {
  return state.farmerForm.orchardName.trim() || "Your orchard";
}

function supporterDisplayName() {
  return state.supporterProfile.name.trim() && state.supporterProfile.name !== "Supporter" ? state.supporterProfile.name : "MyOrchard supporter";
}

function renderEmptyState(title, body, iconName = "leaf") {
  return `<div class="empty-state">${icon(iconName)}<h2>${title}</h2><p class="muted">${body}</p></div>`;
}

function farmerSubmissionReady() {
  return ["fullName", "mobile", "village", "orchardName", "acres", "totalTrees", "bank", "account"].every((field) =>
    String(state.farmerForm[field] || "").trim(),
  );
}

function upsertFarmerVerification() {
  if (!farmerSubmissionReady()) return;
  const record = {
    id: `local-${state.farmerForm.orchardName.trim().toLowerCase().replaceAll(/\s+/g, "-")}`,
    farmer: state.farmerForm.fullName.trim(),
    farm: state.farmerForm.orchardName.trim(),
    district: state.farmerForm.district,
    status: "Pending",
    trees: farmerTotalTrees(),
  };
  state.verifications = [record, ...state.verifications.filter((item) => item.id !== record.id)];
}

function render(preserveFocus = false) {
  const active = document.activeElement;
  const preserveKey = preserveFocus ? active?.dataset?.preserve : null;
  const caret = preserveKey && "selectionStart" in active ? active.selectionStart : null;

  if (!state.role) {
    app.innerHTML = renderWelcome() + renderToast();
  } else if (state.role === "admin") {
    app.innerHTML = renderTopbar("Admin") + renderAdmin() + renderToast();
  } else {
    const roleLabel = state.role === "farmer" ? "Farmer" : "Supporter";
    app.innerHTML = renderTopbar(roleLabel) + renderRoleShell(state.role) + renderToast();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }

  if (preserveKey) {
    const next = document.querySelector(`[data-preserve="${preserveKey}"]`);
    if (next) {
      next.focus();
      if (caret !== null && "setSelectionRange" in next) {
        next.setSelectionRange(caret, caret);
      }
    }
  }
}

function renderBrand() {
  return `
    <div class="brand">
      <span class="brand-mark brand-logo" aria-hidden="true">
        <span class="logo-road r1"></span>
        <span class="logo-road r2"></span>
        <span class="logo-road r3"></span>
        <span class="logo-road r4"></span>
        <span class="logo-dot"></span>
      </span>
      <span>MyOrchard</span>
    </div>
  `;
}

function renderToast() {
  if (!state.toast) return "";
  return `<div class="toast" role="status" aria-live="polite">${icon("check-circle-2")} ${escapeHtml(state.toast)}</div>`;
}

function renderTopbar(label) {
  return `
    <header class="topbar">
      ${renderBrand()}
      <div class="top-actions">
        <span class="pill gold">${icon("leaf")} ${label}</span>
        <span class="pill">${icon("shield-check")} Kalpavriksha Agro</span>
        <button class="btn secondary" type="button" data-action="switch-role">
          ${icon("repeat-2")} Switch role
        </button>
      </div>
    </header>
  `;
}

function renderWelcome() {
  return `
    <main class="welcome">
      <section class="welcome-visual" aria-label="MyOrchard orchard visual">
        <img src="${assets.farmer}" alt="Farmer in a verified cashew orchard" />
      </section>
      <section class="welcome-panel">
        ${renderBrand()}
        <div>
          <span class="eyebrow">${icon("leaf")} Connecting people with orchards</span>
          <h1>MyOrchard app</h1>
          <p class="welcome-copy">
            A verified orchard network where farmers publish trusted farm profiles and supporters follow real tree progress.
          </p>
        </div>
        <div class="context-strip">
          <div class="context-item">
            <b>Verified farms</b>
            <span>KYC, orchard details, and location checks before listing</span>
          </div>
          <div class="context-item">
            <b>Live updates</b>
            <span>Farmers share photos, notes, and progress in one place</span>
          </div>
          <div class="context-item">
            <b>3 districts</b>
            <span>Sindhudurg, Ratnagiri, Kolhapur</span>
          </div>
        </div>
        <div class="role-grid">
          ${renderRoleCard("farmer", "Farmer", "tractor", "Register your orchard, submit verification details, and keep supporters updated.")}
          ${renderRoleCard("supporter", "Supporter", "heart-handshake", "Browse verified orchards, choose trees, and receive progress updates.")}
        </div>
        <div class="team-access">
          <button class="team-link" type="button" data-action="toggle-team-access">
            ${icon("lock-keyhole")} Team access
          </button>
          ${
            state.teamAccessOpen
              ? `<div class="team-panel">
                  <label class="form-row">
                    <span class="label">Work email</span>
                    <input class="input" type="email" value="${escapeHtml(state.loginEmail)}" placeholder="name@kalpavrikshaagro.com" data-field="loginEmail" data-preserve="login-email" />
                  </label>
                  <button class="btn" type="button" data-action="team-login">
                    ${icon("arrow-right")} Continue
                  </button>
                  ${state.loginMessage ? `<p class="login-message">${escapeHtml(state.loginMessage)}</p>` : ""}
                </div>`
              : ""
          }
        </div>
      </section>
    </main>
  `;
}

function renderWelcomePreview() {
  return `
    <div class="phone-preview">
      <div class="phone-status">
        <span>9:41</span>
        <span>${icon("signal")} ${icon("battery-full")}</span>
      </div>
      <div class="phone-head">
        ${renderBrand()}
        <span class="tag">${icon("shield-check")} Verified</span>
      </div>
      ${renderOrchardScene("large")}
      <div class="phone-card-stack">
        <div class="phone-card">
          <span class="metric-icon">${icon("tree-pine")}</span>
          <div><strong>Verified</strong><span>orchard profiles</span></div>
        </div>
        <div class="phone-card">
          <span class="metric-icon">${icon("camera")}</span>
          <div><strong>Updates</strong><span>from the farm</span></div>
        </div>
      </div>
      <button class="btn" type="button" data-action="choose-role" data-role="supporter">${icon("heart-handshake")} Explore orchards</button>
    </div>
    <div class="trust-stack" aria-hidden="true">
      <div class="trust-card"><b>Verified farms</b><span>KYC, geo-tagging, tree count</span></div>
      <div class="trust-card"><b>Monthly updates</b><span>Photos, harvest notes, progress</span></div>
      <div class="trust-card"><b>Clear records</b><span>Certificates, receipts, and activity history</span></div>
    </div>
  `;
}

function renderRoleCard(role, title, iconName, body) {
  return `
    <button class="role-card" type="button" data-action="choose-role" data-role="${role}">
      <span class="role-icon">${icon(iconName)}</span>
      <h2>${title}</h2>
      <p>${body}</p>
      <strong><span class="role-full-action">Continue as ${title}</span><span class="role-mobile-action">Continue</span></strong>
    </button>
  `;
}

function renderOrchardScene(size = "medium") {
  return `
    <div class="orchard-scene ${size}">
      <div class="sky-line"></div>
      <div class="sun-dot"></div>
      <div class="tree-row row-a">${Array.from({ length: 7 }, (_, index) => `<span style="--i:${index}"></span>`).join("")}</div>
      <div class="tree-row row-b">${Array.from({ length: 6 }, (_, index) => `<span style="--i:${index}"></span>`).join("")}</div>
      <div class="field-lines">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="map-pin">${icon("map-pin")}</div>
    </div>
  `;
}

function renderMiniOrchardMark() {
  return `
    <span class="mini-sun"></span>
    <span class="mini-tree"></span>
    <span class="mini-tree"></span>
    <span class="mini-tree"></span>
  `;
}

function renderRoleShell(role) {
  const currentTab = role === "farmer" ? state.farmerTab : state.supporterTab;
  const content = role === "farmer" ? renderFarmerContent() : renderSupporterContent();
  return `
    <div class="shell">
      <aside class="rail">
        <div class="rail-section">
          <span class="rail-label">${role}</span>
          ${renderNavItems(role, currentTab)}
        </div>
        <div class="rail-label">Program</div>
        <div class="card">
          <span class="tag gold">${icon("shield-check")} Trust workflow</span>
          <p class="muted" style="margin-top:10px">Verified orchard profiles, supporter updates, and secure records in one place.</p>
        </div>
      </aside>
      <main class="main">${content}</main>
      <nav class="bottom-nav">${renderNavItems(role, currentTab)}</nav>
    </div>
  `;
}

function renderNavItems(role, active) {
  return nav[role]
    .map(
      ([id, label, iconName]) => `
        <button class="nav-item ${active === id ? "active" : ""}" type="button"
          data-action="nav" data-role="${role}" data-tab="${id}">
          ${icon(iconName)} <span>${label}</span>
        </button>
      `,
    )
    .join("");
}

function renderFarmerContent() {
  switch (state.farmerTab) {
    case "dashboard":
      return renderFarmerDashboard();
    case "onboarding":
      return renderFarmerOnboarding();
    case "updates":
      return renderFarmerUpdates();
    case "profile":
      return renderFarmerProfile();
    default:
      return renderFarmerDashboard();
  }
}

function renderSupporterContent() {
  switch (state.supporterTab) {
    case "home":
      return renderSupporterHome();
    case "orchards":
      return renderOrchardListing();
    case "farm":
      return renderFarmDetail();
    case "adoption":
      return state.adoptionComplete ? renderCertificateScreen() : renderAdoptionPayment();
    case "updates":
      return renderSupporterUpdates();
    case "profile":
      return renderSupporterProfile();
    default:
      return renderSupporterHome();
  }
}

function renderPageTitle(title, body, actions = "") {
  return `
    <div class="page-title">
      <div>
        <h1>${title}</h1>
        <p>${body}</p>
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ""}
    </div>
  `;
}

function renderFarmerOnboarding() {
  const steps = ["Basic info", "KYC", "Orchard", "Review"];
  return `
    ${renderPageTitle(
      "Farmer onboarding",
      "Register the farmer, verify identity, capture orchard details, and submit for admin approval.",
      state.farmerSubmitted
        ? `<span class="pill">${icon("shield-check")} Submitted</span>`
        : `<span class="pill clay">${icon("clock")} In progress</span>`,
    )}
    <div class="content-grid">
      <section>
        <div class="stepper">
          ${steps
            .map(
              (step, index) => `
                <div class="step ${index === state.farmerStep ? "active" : ""} ${index < state.farmerStep ? "done" : ""}">
                  <span class="step-number">${index + 1}</span>
                  <span>${step}</span>
                </div>
              `,
            )
            .join("")}
        </div>
        <div class="form-panel">
          ${renderFarmerStep()}
          <div class="page-actions" style="margin-top:18px">
            ${
              state.farmerStep > 0
                ? `<button class="btn secondary" type="button" data-action="farmer-back">${icon("arrow-left")} Back</button>`
                : ""
            }
            ${
              state.farmerStep < 3
                ? `<button class="btn" type="button" data-action="farmer-next">Next ${icon("chevron-right")}</button>`
                : `<button class="btn gold" type="button" data-action="farmer-submit">${icon("send")} Submit for verification</button>`
            }
          </div>
        </div>
      </section>
      <aside>
        <div class="image-panel">
          <img src="${assets.farmer}" alt="Farmer onboarding with geo tagging" />
        </div>
        <div class="card" style="margin-top:14px">
          <div class="section-title">
            <h3>Verification checklist</h3>
            ${icon("clipboard-check")}
          </div>
          <div class="timeline">
            ${["Farmer identity", "Bank details", "Geo-tagged location", "Crop and tree count"].map(
              (item) => `
                <div class="timeline-item">
                  <span class="timeline-dot">${icon("check")}</span>
                  <div class="timeline-card"><strong>${item}</strong></div>
                </div>
              `,
            ).join("")}
          </div>
        </div>
      </aside>
    </div>
  `;
}

function inputRow(label, field, type = "text", full = false) {
  const value = escapeHtml(state.farmerForm[field] || "");
  return `
    <label class="form-row ${full ? "full" : ""}">
      <span class="label">${label}</span>
      <input class="input" type="${type}" value="${value}" data-field="${field}" data-preserve="farmer-${field}" />
    </label>
  `;
}

function selectRow(label, field, options, full = false) {
  const value = state.farmerForm[field] || "";
  return `
    <label class="form-row ${full ? "full" : ""}">
      <span class="label">${label}</span>
      <select class="select" data-field="${field}">
        ${options
          .map((option) => `<option value="${option}" ${value === option ? "selected" : ""}>${option}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function renderFarmerStep() {
  if (state.farmerStep === 0) {
    return `
      <div class="section-title"><h2>Basic information</h2><span class="tag">${icon("user")} Farmer</span></div>
      <div class="form-grid">
        ${inputRow("Full name", "fullName")}
        ${inputRow("Mobile number", "mobile")}
        ${selectRow("District", "district", districts)}
        ${inputRow("Village", "village")}
      </div>
    `;
  }

  if (state.farmerStep === 1) {
    return `
      <div class="section-title"><h2>KYC and payment details</h2><span class="tag gold">${icon("shield-check")} Secure</span></div>
      <div class="form-grid">
        ${inputRow("Aadhaar number", "aadhaar")}
        ${inputRow("Bank name", "bank")}
        ${inputRow("Account number", "account")}
        ${selectRow("Ownership type", "ownership", ["Owned", "Leased", "Family owned"])}
      </div>
    `;
  }

  if (state.farmerStep === 2) {
    return `
      <div class="section-title"><h2>Orchard details</h2><span class="tag">${icon("map-pin")} Geo tagged</span></div>
      <div class="form-grid">
        ${inputRow("Orchard name", "orchardName")}
        ${inputRow("Total land acres", "acres", "number")}
        ${inputRow("Total trees", "totalTrees", "number")}
        ${selectRow("Crop type", "crop", ["Cashew", "Mango", "Coconut", "Mixed orchard"])}
        <label class="form-row full">
          <span class="label">Upload orchard photos</span>
          <input class="input" type="file" multiple />
        </label>
      </div>
    `;
  }

  return `
    <div class="section-title"><h2>Review submission</h2><span class="tag clay">${icon("file-text")} Ready</span></div>
    <div class="grid-2">
      <div class="card">
        <span class="label">Farmer</span>
        <h3>${escapeHtml(state.farmerForm.fullName || "Name pending")}</h3>
        <p class="muted">${escapeHtml(state.farmerForm.village || "Village pending")}, ${escapeHtml(state.farmerForm.district)}</p>
      </div>
      <div class="card">
        <span class="label">Orchard</span>
        <h3>${escapeHtml(farmerOrchardName())}</h3>
        <p class="muted">${escapeHtml(state.farmerForm.totalTrees || "0")} ${escapeHtml(state.farmerForm.crop)} trees across ${escapeHtml(state.farmerForm.acres || "0")} acres</p>
      </div>
    </div>
  `;
}

function renderFarmerDashboard() {
  const name = escapeHtml(farmerDisplayName());
  const totalTrees = farmerTotalTrees();
  return `
    ${renderPageTitle(
      `Hello, ${name}`,
      "Track orchard verification, listed trees, supporter interest, and field activity.",
      `<button class="btn" type="button" data-action="nav" data-role="farmer" data-tab="updates">${icon("upload")} Upload update</button>`,
    )}
    <div class="dashboard-grid">
      ${metric("Total trees", totalTrees, "tree-pine", "Submitted for listing")}
      ${metric("Adopted trees", "0", "heart-handshake", "Updates after first adoption")}
      ${metric("Available trees", totalTrees, "clock", "Ready after verification")}
      ${metric("Account status", state.farmerSubmitted ? "Submitted" : "Draft", "shield-check", "Verification workflow")}
    </div>
    <div class="content-grid">
      <section>
        <div class="visual-band">
          <div>
            <span class="tag">${icon("shield-check")} Verification active</span>
            <h2>${escapeHtml(farmerOrchardName())}</h2>
            <p>${escapeHtml(state.farmerForm.crop)} orchard in ${escapeHtml(state.farmerForm.district)} with verification tracking and monthly growth reporting.</p>
            <div class="meta-row">
              <span class="tag gold">${escapeHtml(state.farmerForm.acres || "0")} acres</span>
              <span class="tag">${escapeHtml(state.farmerForm.crop)}</span>
              <span class="tag clay">${state.farmerSubmitted ? "Submitted for review" : "Draft profile"}</span>
            </div>
          </div>
          <img src="${assets.trust}" alt="Verified orchard trust view" />
        </div>
        <div class="section" style="margin-top:18px">
          <div class="section-title"><h2>Recent adoptions</h2><button class="btn secondary" type="button" data-action="export-csv" data-export="farmer-adoptions">${icon("download")} Export</button></div>
          <div class="list">
            ${renderEmptyState("No adoptions yet", "Adoption records will appear here after your orchard is approved and supporters adopt trees.", "heart-handshake")}
          </div>
        </div>
      </section>
      <aside class="card">
        <div class="section-title"><h2>Activity</h2>${icon("bell")}</div>
        ${state.farmerUpdates.length ? renderTimeline(state.farmerUpdates) : renderEmptyState("No updates yet", "Publish your first field update after submitting the orchard profile.", "camera")}
      </aside>
    </div>
  `;
}

function renderFarmerUpdates() {
  return `
    ${renderPageTitle("Farm updates", "Publish growth notes for supporters who adopted trees from your orchard.")}
    <div class="content-grid">
      <section class="form-panel">
        <div class="section-title"><h2>New field update</h2><span class="tag">${icon("camera")} Monthly</span></div>
        <label class="form-row full">
          <span class="label">Update title</span>
          <input class="input" value="" placeholder="Example: Flowering stage completed" data-field="newUpdateTitle" data-preserve="new-update-title" />
        </label>
        <label class="form-row full" style="margin-top:14px">
          <span class="label">Update details</span>
          <textarea class="textarea" placeholder="Write what changed in the orchard this month" data-field="updateDraft" data-preserve="update-draft">${escapeHtml(state.updateDraft)}</textarea>
        </label>
        <div class="page-actions" style="margin-top:14px">
          <button class="btn secondary" type="button">${icon("image")} Add photos</button>
          <button class="btn" type="button" data-action="publish-update">${icon("send")} Publish update</button>
        </div>
      </section>
      <aside class="card">
        <div class="section-title"><h2>Published updates</h2>${icon("history")}</div>
        ${state.farmerUpdates.length ? renderTimeline(state.farmerUpdates) : renderEmptyState("No published updates", "Your field notes will appear here after you publish them.", "history")}
      </aside>
    </div>
  `;
}

function renderFarmerProfile() {
  const location = `${state.farmerForm.village || "Village pending"}, ${state.farmerForm.district}`;
  return `
    ${renderPageTitle("Profile", "Your public farmer identity, trust status, and payout readiness.")}
    <section class="profile-shell">
      <div class="profile-cover">
        ${renderOrchardScene("cover")}
      </div>
      <div class="profile-head">
        <div class="avatar xl">${icon("tractor")}</div>
        <div>
          <div class="meta-row">
            <h2>${escapeHtml(farmerDisplayName())}</h2>
            <span class="pill">${icon("shield-check")} ${state.farmerSubmitted ? "Submitted farmer" : "Verification draft"}</span>
          </div>
          <p class="muted">${state.farmerProfile.handle} - ${escapeHtml(location)}</p>
          <p>${state.farmerSubmitted ? "Your orchard profile is ready for verification review." : state.farmerProfile.bio}</p>
        </div>
        <div class="profile-actions">
          <button class="btn secondary" type="button">${icon("edit-3")} Edit</button>
          <button class="btn" type="button" data-action="nav" data-role="farmer" data-tab="updates">${icon("camera")} Post update</button>
        </div>
      </div>
      <div class="profile-stats">
        <div><strong>${escapeHtml(state.farmerForm.totalTrees || "0")}</strong><span>Trees</span></div>
        <div><strong>0</strong><span>Adopted</span></div>
        <div><strong>${state.farmerSubmitted ? "Review" : "Draft"}</strong><span>Status</span></div>
        <div><strong>${state.farmerUpdates.length}</strong><span>Updates</span></div>
      </div>
    </section>
    <div class="profile-grid">
      <section class="card">
        <div class="section-title"><h2>Account</h2><span class="tag">${icon("user")} Private</span></div>
        <div class="info-list">
          <div><span>Mobile</span><strong>${escapeHtml(state.farmerForm.mobile || "Pending")}</strong></div>
          <div><span>Bank</span><strong>${escapeHtml(state.farmerForm.bank || "Pending")}</strong></div>
          <div><span>Account</span><strong>${escapeHtml(state.farmerForm.account || "Pending")}</strong></div>
        </div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Orchard</h2><span class="tag gold">${icon("tree-pine")} ${escapeHtml(state.farmerForm.crop)}</span></div>
        <div class="info-list">
          <div><span>Name</span><strong>${escapeHtml(farmerOrchardName())}</strong></div>
          <div><span>Location</span><strong>${escapeHtml(location)}</strong></div>
          <div><span>Land</span><strong>${escapeHtml(state.farmerForm.acres || "0")} acres</strong></div>
        </div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Trust checklist</h2><span class="tag">${icon("badge-check")} Complete</span></div>
        ${renderChecklist(["KYC verified", "Bank ready", "Location geo-tagged", "Monthly update rhythm"])}
      </section>
    </div>
  `;
}

function renderSupporterHome() {
  const totals = orchardTotals();
  return `
    ${renderPageTitle(
      "Welcome",
      "Browse verified cashew orchards and stay connected to real farm progress.",
      `<button class="btn" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("search")} Find orchards</button>`,
    )}
    <div class="dashboard-grid">
      ${metric("Published farms", orchards.length, "tree-pine", "Verified orchard profiles")}
      ${metric("Available trees", totals.available, "leaf", "Open for adoption")}
      ${metric("Districts", new Set(orchards.map((farm) => farm.district)).size, "map-pin", "Launch coverage")}
      ${metric("Certificates", state.adoptionComplete ? "1" : "0", "badge-check", "After adoption")}
    </div>
    <div class="content-grid">
      <section>
        <div class="visual-band">
          <div>
            <span class="tag gold">${icon("heart-handshake")} Supporter journey</span>
            <h2>Adopt cashew trees from real farmer orchards</h2>
            <p>Every farm profile includes verification status, tree availability, location, and progress updates before checkout.</p>
            <div class="meta-row">
              ${districts.map((district) => `<button class="chip" type="button" data-action="district-chip" data-district="${district}">${district}</button>`).join("")}
            </div>
          </div>
          <img src="${assets.supporter}" alt="Supporter impact view" />
        </div>
        <div class="section" style="margin-top:18px">
          <div class="section-title"><h2>Recommended orchards</h2><button class="btn secondary" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("filter")} View all</button></div>
          <div class="list">${orchards.length ? orchards.slice(0, 3).map(renderOrchardCard).join("") : renderEmptyState("No orchards published yet", "Verified farms will appear here as soon as they are approved by the team.", "tree-pine")}</div>
        </div>
      </section>
      <aside class="card">
        <div class="section-title"><h2>Impact updates</h2>${icon("bar-chart-3")}</div>
        ${state.adoptionComplete
          ? renderTimeline([
              { title: "Adoption confirmed", date: "06 Jul 2026", body: "Your certificate is ready and the first farm update will follow." },
            ])
          : renderEmptyState("No impact updates yet", "Adopt from a verified farm to start receiving progress notes and certificates.", "bell")}
      </aside>
    </div>
  `;
}

function renderOrchardListing() {
  const filtered = orchards.filter((farm) => {
    const term = state.orchardSearch.trim().toLowerCase();
    const matchesTerm =
      !term ||
      farm.name.toLowerCase().includes(term) ||
      farm.farmer.toLowerCase().includes(term) ||
      farm.district.toLowerCase().includes(term);
    const matchesDistrict = state.districtFilter === "All" || farm.district === state.districtFilter;
    return matchesTerm && matchesDistrict;
  });

  return `
    ${renderPageTitle("Orchards", "Search verified farms and choose trees available for adoption.")}
    <div class="toolbar">
      <label class="input-wrap">
        ${icon("search")}
        <input class="input" placeholder="Search by farm, farmer, or district" value="${escapeHtml(state.orchardSearch)}"
          data-filter="search" data-preserve="orchard-search" />
      </label>
      <select class="select" data-filter="district">
        ${["All", ...districts].map((district) => `<option value="${district}" ${state.districtFilter === district ? "selected" : ""}>${district}</option>`).join("")}
      </select>
      <button class="btn secondary" type="button" data-action="clear-filters">${icon("rotate-ccw")} Reset</button>
    </div>
    <div class="list">
      ${filtered.length ? filtered.map(renderOrchardCard).join("") : renderEmptyState("No orchards published yet", "Verified farms will appear here after the team approves orchard records in Supabase.", "tree-pine")}
    </div>
  `;
}

function renderOrchardCard(farm) {
  return `
    <article class="list-card">
      <img class="thumb" src="${farm.image}" alt="${farm.name}" />
      <div>
        <div class="meta-row">
          <h3>${farm.name}</h3>
          <span class="tag">${icon("shield-check")} Verified</span>
        </div>
        <p>${farm.farmer} - ${farm.village}, ${farm.district}</p>
        <div class="mini-row">
          <span class="tag gold">${farm.available} trees available</span>
          <span class="tag">${farm.rating} rating</span>
          <span class="tag clay">Verified listing</span>
        </div>
      </div>
      <button class="btn secondary" type="button" data-action="open-farm" data-farm="${farm.id}">
        View farm ${icon("chevron-right")}
      </button>
    </article>
  `;
}

function renderFarmDetail() {
  const farm = selectedFarm();
  if (!farm) {
    return `
      ${renderPageTitle(
        "Farm details",
        "Verified farms will appear here after the team publishes orchard records.",
        `<button class="btn secondary" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("arrow-left")} Back to orchards</button>`,
      )}
      ${renderEmptyState("No farm selected", "Choose a verified orchard from the listing once farms are available.", "tree-pine")}
    `;
  }
  return `
    ${renderPageTitle(
      farm.name,
      `${farm.farmer} - ${farm.village}, ${farm.district}, ${farm.state}`,
      `<button class="btn secondary" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("arrow-left")} Back</button>
       <button class="btn" type="button" data-action="start-adoption">${icon("heart-handshake")} Adopt trees</button>`,
    )}
    <section class="farm-hero">
      <div class="farm-photo">
        <img src="${farm.image}" alt="${farm.name} orchard" />
      </div>
      <aside class="farm-summary">
        <span class="pill">${icon("shield-check")} Verified farm</span>
        <h1>${farm.name}</h1>
        <p class="muted">${farm.summary}</p>
        <div class="stat-line">
          <div class="stat-box"><small>Farm size</small><strong>${farm.acres} acres</strong></div>
          <div class="stat-box"><small>Total trees</small><strong>${farm.totalTrees}</strong></div>
          <div class="stat-box"><small>Available</small><strong>${farm.available}</strong></div>
        </div>
        <div class="card">
          <span class="label">Geo tagged coordinates</span>
          <p class="muted" style="margin-top:7px">${farm.coordinates}</p>
        </div>
        <button class="btn" type="button" data-action="start-adoption">${icon("credit-card")} Adopt from this farm</button>
      </aside>
    </section>
    <div class="grid-3">
      <div class="card"><span class="metric-icon">${icon("shield-check")}</span><h3>Verified identity</h3><p class="muted">Farmer profile and farm details reviewed by Kalpavriksha Agro.</p></div>
      <div class="card"><span class="metric-icon">${icon("map-pin")}</span><h3>Physical connection</h3><p class="muted">Farm location and coordinates visible before adoption.</p></div>
      <div class="card"><span class="metric-icon">${icon("camera")}</span><h3>Continuous updates</h3><p class="muted">Photo and growth updates keep supporters connected.</p></div>
    </div>
  `;
}

function renderAdoptionPayment() {
  const farm = selectedFarm();
  if (!farm) {
    return `
      ${renderPageTitle(
        "Adopt a tree",
        "Choose a verified farm before starting checkout.",
        `<button class="btn secondary" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("arrow-left")} Browse orchards</button>`,
      )}
      ${renderEmptyState("No farm selected", "Adoption checkout will be available after selecting a published orchard.", "heart-handshake")}
    `;
  }
  const unit = programConfig.adoptionAmount;
  const total = unit * state.treeCount;

  return `
    ${renderPageTitle(
      "Adopt a tree",
      `${farm.name} - ${farm.district}`,
      `<button class="btn secondary" type="button" data-action="open-farm" data-farm="${farm.id}">${icon("arrow-left")} Farm details</button>`,
    )}
    <section class="adoption-layout">
      <div class="card">
        <div class="section-title"><h2>Your selection</h2><span class="tag">${icon("shield-check")} Verified</span></div>
        <div class="list-card" style="grid-template-columns:96px minmax(0,1fr)">
          <img class="thumb" src="${farm.image}" alt="${farm.name}" />
          <div>
            <h3>${farm.name}</h3>
            <p>${farm.farmer} - ${farm.village}, ${farm.district}</p>
            <div class="mini-row"><span class="tag gold">${farm.available} available</span></div>
          </div>
        </div>
        <div class="section" style="margin-top:18px">
          <div class="section-title">
            <h3>Number of trees</h3>
            <div class="counter">
              <button class="icon-btn" type="button" data-action="tree-count" data-delta="-1" aria-label="Decrease tree count">${icon("minus")}</button>
              <span class="counter-value">${state.treeCount}</span>
              <button class="icon-btn" type="button" data-action="tree-count" data-delta="1" aria-label="Increase tree count">${icon("plus")}</button>
            </div>
          </div>
          <div class="payment-breakdown">
            <div class="breakdown-row"><span>Adoption amount per tree</span><strong>${money(unit)}</strong></div>
            <div class="breakdown-row"><span>Selected trees</span><strong>${state.treeCount}</strong></div>
            <div class="breakdown-row"><span>Receipt and certificate</span><strong>Included</strong></div>
            <div class="breakdown-row"><span>Total</span><strong>${money(total)}</strong></div>
          </div>
        </div>
      </div>
      <div class="form-panel">
        <div class="section-title"><h2>Payment</h2><span class="pill">${icon("lock")} Secure</span></div>
        <div class="method-grid">
          ${["UPI", "Card", "Net banking"].map(
            (method) => `
              <button class="chip ${state.paymentMethod === method ? "active" : ""}" type="button" data-action="payment-method" data-method="${method}">
                ${icon(method === "UPI" ? "smartphone" : method === "Card" ? "credit-card" : "landmark")} ${method}
              </button>
            `,
          ).join("")}
        </div>
        <div class="grid-2" style="margin-top:18px">
          <label class="form-row">
            <span class="label">Supporter name</span>
            <input class="input" placeholder="Enter supporter name" />
          </label>
          <label class="form-row">
            <span class="label">Mobile number</span>
            <input class="input" placeholder="Enter mobile number" />
          </label>
        </div>
        <div class="card" style="margin-top:18px">
          <div class="section-title"><h3>Adoption summary</h3><span class="tag gold">${state.treeCount} tree${state.treeCount > 1 ? "s" : ""}</span></div>
          <p class="muted">A digital certificate and monthly orchard updates will be added to My Adoption after payment.</p>
        </div>
        <div class="page-actions" style="margin-top:18px">
          <button class="btn gold" type="button" data-action="complete-payment">${icon("lock-keyhole")} Pay ${money(total)}</button>
        </div>
      </div>
    </section>
  `;
}

function renderCertificateScreen() {
  const farm = selectedFarm();
  if (!farm) {
    return `
      ${renderPageTitle("Adoption complete", "No selected farm found.", "")}
      ${renderEmptyState("Certificate unavailable", "Please choose an orchard and complete checkout again.", "badge-check")}
    `;
  }
  return `
    ${renderPageTitle(
      "Adoption complete",
      "Your certificate and farm update timeline are ready.",
      `<button class="btn secondary" type="button" data-action="new-adoption">${icon("tree-pine")} Adopt another tree</button>`,
    )}
    <div class="adoption-layout">
      <section class="certificate">
        <span class="brand" style="justify-content:center">${renderBrand()}</span>
        <p class="eyebrow" style="justify-content:center;margin-top:18px">${icon("badge-check")} Certificate of tree adoption</p>
        <h1>This is to certify that</h1>
        <span class="recipient">${escapeHtml(supporterDisplayName())}</span>
        <p class="muted">has adopted</p>
        <h2>${state.treeCount} Cashew Tree${state.treeCount > 1 ? "s" : ""}</h2>
        <p class="muted">from ${farm.name}, ${farm.district}, Maharashtra</p>
        <div class="meta-row" style="justify-content:center;margin-top:18px">
          <span class="tag gold">Date: 06 July 2026</span>
          <span class="tag">Certificate ID: MYO-${farm.id.toUpperCase()}-${state.treeCount}26</span>
        </div>
      </section>
      <aside class="card">
        <div class="section-title"><h2>Adoption updates</h2>${icon("bell")}</div>
        ${renderTimeline([
          { title: "Adoption confirmed", date: "06 Jul 2026", body: `${state.treeCount} tree adoption added to ${farm.name}.` },
          { title: "Receipt generated", date: "06 Jul 2026", body: `${money(programConfig.adoptionAmount * state.treeCount)} recorded for this adoption.` },
          { title: "First field update", date: "Expected 06 Aug 2026", body: "The farmer will share a monthly photo and growth note." },
        ])}
        <div class="page-actions" style="margin-top:18px">
          <button class="btn" type="button" data-action="download-certificate">${icon("download")} Download certificate</button>
        </div>
      </aside>
    </div>
  `;
}

function renderSupporterUpdates() {
  const farm = selectedFarm();
  return `
    ${renderPageTitle("Updates", "Track tree progress, farmer notes, and adoption milestones.")}
    <div class="content-grid">
      <section class="card">
        <div class="section-title"><h2>${farm ? farm.name : "Farm updates"}</h2><span class="tag">${state.adoptionComplete ? `${state.treeCount} tree${state.treeCount > 1 ? "s" : ""}` : "No adoption yet"}</span></div>
        ${state.adoptionComplete && farm
          ? renderTimeline([
              { title: "Adoption confirmed", date: "06 Jul 2026", body: `${state.treeCount} tree adoption added to ${farm.name}.` },
              { title: "First field update", date: "Expected 06 Aug 2026", body: "The farmer will share a monthly photo and growth note." },
            ])
          : renderEmptyState("No updates yet", "Updates will begin after you adopt from a verified orchard.", "bell")}
      </section>
      <aside class="image-panel">
        <img src="${assets.trust}" alt="Farm transparency update" />
      </aside>
    </div>
  `;
}

function renderSupporterProfile() {
  return `
    ${renderPageTitle("Profile", "Your adoption identity, certificates, saved farms, and impact summary.")}
    <section class="profile-shell">
      <div class="profile-cover supporter-cover">
        ${renderOrchardScene("cover")}
      </div>
      <div class="profile-head">
        <div class="avatar xl">${icon("heart-handshake")}</div>
        <div>
          <div class="meta-row">
            <h2>${state.supporterProfile.name}</h2>
            <span class="pill">${icon("leaf")} Green supporter</span>
          </div>
          <p class="muted">${state.supporterProfile.handle} - ${state.supporterProfile.location}</p>
          <p>${state.supporterProfile.bio}</p>
        </div>
        <div class="profile-actions">
          <button class="btn secondary" type="button">${icon("edit-3")} Edit</button>
          <button class="btn" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("tree-pine")} Adopt</button>
        </div>
      </div>
      <div class="profile-stats">
        <div><strong>${state.adoptionComplete ? state.treeCount : 0}</strong><span>Trees</span></div>
        <div><strong>${state.adoptionComplete ? 1 : 0}</strong><span>Farmers</span></div>
        <div><strong>${state.adoptionComplete ? 1 : 0}</strong><span>Certificates</span></div>
        <div><strong>${orchards.length}</strong><span>Farms live</span></div>
      </div>
    </section>
    <div class="profile-grid">
      <section class="card">
        <div class="section-title"><h2>Contact</h2><span class="tag">${icon("lock")} Private</span></div>
        <div class="info-list">
          <div><span>Mobile</span><strong>${state.supporterProfile.mobile}</strong></div>
          <div><span>Email</span><strong>${state.supporterProfile.email}</strong></div>
          <div><span>Location</span><strong>${state.supporterProfile.location}</strong></div>
        </div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Adoption history</h2>${icon("badge-check")}</div>
        <div class="list">
          ${state.adoptionComplete && selectedFarm()
            ? `<div class="list-card compact"><div><h3>${selectedFarm().name}</h3><p>${state.treeCount} tree${state.treeCount > 1 ? "s" : ""} - certificate ready</p></div><span class="pill">Active</span></div>`
            : renderEmptyState("No adoption history", "Adopt from a verified farm to build your certificate timeline.", "badge-check")}
        </div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Saved farms</h2><button class="btn secondary" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("search")} Browse</button></div>
        ${orchards.length ? renderChecklist(orchards.slice(0, 3).map((farm) => farm.name)) : renderEmptyState("No saved farms yet", "Browse verified farms and save the ones you want to revisit.", "search")}
      </section>
    </div>
  `;
}

function renderAdmin() {
  return `
    <div class="admin-shell">
      <aside class="admin-rail">
        ${renderBrand()}
        <div class="rail-label" style="color:rgba(255,253,246,.72)">Admin tools</div>
        <div class="rail-section">${renderNavItems("admin", state.adminTab)}</div>
      </aside>
      <main class="main">${renderAdminContent()}</main>
      <nav class="bottom-nav">${renderNavItems("admin", state.adminTab)}</nav>
    </div>
  `;
}

function renderAdminContent() {
  switch (state.adminTab) {
    case "farmers":
      return renderAdminFarmers();
    case "orchards":
      return renderAdminOrchards();
    case "verifications":
      return renderAdminVerifications();
    case "payments":
      return renderAdminPayments();
    case "reports":
      return renderAdminReports();
    case "settings":
      return renderAdminSettings();
    default:
      return renderAdminDashboard();
  }
}

function renderAdminDashboard() {
  const totals = orchardTotals();
  return `
    ${renderPageTitle(
      "Dashboard overview",
      "Monitor farmer onboarding, orchard inventory, adoptions, and operational health.",
      `<span class="pill gold">${icon("calendar")} Jul 2026</span>`,
    )}
    <div class="dashboard-grid">
      ${metric("Farmers in review", state.verifications.length, "users", "Verification records")}
      ${metric("Published orchards", orchards.length, "tree-pine", "Live farm listings")}
      ${metric("Trees available", totals.available, "leaf", "Open inventory")}
      ${metric("Trees adopted", totals.adopted, "heart-handshake", "Across live farms")}
    </div>
    <div class="content-grid">
      <section class="card">
        <div class="section-title"><h2>Adoptions over time</h2><span class="tag">This year</span></div>
        ${renderChart()}
      </section>
      <aside class="card">
        <div class="section-title"><h2>Verification queue</h2><button class="btn secondary" type="button" data-action="nav" data-role="admin" data-tab="verifications">${icon("arrow-right")} Open</button></div>
        <div class="list">
          ${state.verifications.filter((item) => item.status === "Pending").map(renderQueueItem).join("") || `<p class="muted">No pending verifications.</p>`}
        </div>
      </aside>
    </div>
  `;
}

function renderAdminFarmers() {
  return `
    ${renderPageTitle("Farmers", "Review registered farmers, KYC state, and payout readiness.")}
    <div class="list">
      ${state.verifications.length ? state.verifications.map((item) => `
        <div class="list-card compact">
          <div>
            <h3>${item.farmer}</h3>
            <p>${item.farm} - ${item.district} - ${item.trees} trees</p>
          </div>
          <span class="pill ${item.status === "Pending" ? "clay" : ""}">${item.status}</span>
        </div>
      `).join("") : renderEmptyState("No farmer records", "New farmer verification records will appear here from Supabase.", "users")}
    </div>
  `;
}

function renderAdminOrchards() {
  return `
    ${renderPageTitle("Orchards", "Manage registered farms, tree inventory, adoption availability, and locations.")}
    <div class="list">${orchards.length ? orchards.map(renderOrchardCard).join("") : renderEmptyState("No orchards published", "Approved orchards will appear here after records are created in Supabase.", "tree-pine")}</div>
  `;
}

function renderAdminVerifications() {
  return `
    ${renderPageTitle("Farm verification", "Approve KYC and geo-tagged orchard submissions before public listing.")}
    <div class="list">${state.verifications.length ? state.verifications.map(renderQueueItem).join("") : renderEmptyState("No verification queue", "Farmer submissions will appear here when they are ready for review.", "shield-check")}</div>
  `;
}

function renderAdminPayments() {
  const totals = orchardTotals();
  const collected = totals.adopted * programConfig.adoptionAmount;
  return `
    ${renderPageTitle("Payments", "Track adoption receipts, certificate readiness, and payout operations.")}
    <div class="dashboard-grid">
      ${metric("Collected", money(collected), "banknote", "From live adoption counts")}
      ${metric("Adopted trees", totals.adopted, "tree-pine", "Across published farms")}
      ${metric("Receipts", totals.adopted, "badge-check", "Certificate-linked records")}
      ${metric("Pending review", state.verifications.filter((item) => item.status === "Pending").length, "clock", "Farmer records")}
    </div>
    <div class="card">
      <div class="section-title"><h2>Recent collections</h2><button class="btn secondary" type="button" data-action="export-csv" data-export="admin-payments">${icon("download")} Export CSV</button></div>
      <div class="list">
        ${orchards.filter((farm) => Number(farm.adopted) > 0).length ? orchards.filter((farm) => Number(farm.adopted) > 0).map((farm) => {
          const trees = Number(farm.adopted) || 0;
          const total = trees * programConfig.adoptionAmount;
          return `
          <div class="list-card compact">
            <div><h3>${farm.name}</h3><p>${farm.farmer} - ${trees} adopted trees</p></div>
            <span class="pill">${money(total)}</span>
          </div>
        `}).join("") : renderEmptyState("No payment records yet", "Collections will appear after supporters complete adoption checkout.", "wallet")}
      </div>
    </div>
  `;
}

function renderAdminReports() {
  const totals = orchardTotals();
  return `
    ${renderPageTitle("Reports", "View adoption, farmer support, and sustainability indicators.")}
    <div class="grid-2">
      <div class="card">
        <div class="section-title"><h2>Impact summary</h2><span class="tag gold">Live inventory</span></div>
        ${renderImpactSummary(totals)}
      </div>
      <div class="card">
        <div class="section-title"><h2>Monthly trend</h2><span class="tag">Adoptions</span></div>
        ${renderChart()}
      </div>
    </div>
  `;
}

function renderAdminSettings() {
  return `
    ${renderPageTitle("Settings", "Configure districts, crop types, adoption amount, and approval rules.")}
    <div class="grid-2">
      <div class="form-panel">
        <div class="form-grid">
          <label class="form-row"><span class="label">Adoption amount per tree</span><input class="input" value="${programConfig.adoptionAmount}" /></label>
          <label class="form-row"><span class="label">Crop focus</span><input class="input" value="Cashew" /></label>
          <label class="form-row"><span class="label">Verification requirement</span><input class="input" value="KYC, location, tree count" /></label>
          <label class="form-row"><span class="label">Update frequency</span><input class="input" value="Monthly" /></label>
          <label class="form-row full"><span class="label">Launch districts</span><input class="input" value="Sindhudurg, Ratnagiri, Kolhapur" /></label>
        </div>
        <div class="page-actions" style="margin-top:18px"><button class="btn">${icon("save")} Save settings</button></div>
      </div>
      ${renderSupabaseStatus()}
    </div>
  `;
}

function renderSupabaseStatus() {
  const connected = ["connected", "live", "empty"].includes(supabaseBridge.status);
  const live = supabaseBridge.status === "live";
  return `
    <section class="card">
      <div class="section-title">
        <h2>Data connection</h2>
        <span class="tag ${connected ? "" : "clay"}">${icon(live ? "database" : connected ? "plug-zap" : "database-zap")} ${live ? "Live data" : connected ? "Supabase ready" : "Connecting"}</span>
      </div>
      <div class="info-list">
        <div><span>Project ref</span><strong>${supabaseConfig.projectRef}</strong></div>
        <div><span>Endpoint</span><strong>supabase.co</strong></div>
        <div><span>Client key</span><strong>Publishable</strong></div>
        <div><span>Data source</span><strong>${supabaseBridge.dataSource}</strong></div>
        <div><span>Tables checked</span><strong>orchards, verifications, updates</strong></div>
        <div><span>Last sync</span><strong>${supabaseBridge.lastSync || "Waiting"}</strong></div>
      </div>
      <p class="muted" style="margin-top:14px">${supabaseBridge.message}</p>
      <p class="muted" style="margin-top:8px">Server-only database URLs are kept out of the frontend.</p>
    </section>
  `;
}

function renderQueueItem(item) {
  const isPending = item.status === "Pending";
  return `
    <div class="queue-item">
      <div>
        <h3>${item.farm}</h3>
        <p>${item.farmer} - ${item.district} - ${item.trees} trees</p>
        <div class="mini-row"><span class="tag ${isPending ? "clay" : ""}">${item.status}</span></div>
      </div>
      <div class="page-actions">
        ${
          isPending
            ? `<button class="btn" type="button" data-action="admin-verify" data-id="${item.id}">${icon("shield-check")} Approve</button>
               <button class="btn secondary" type="button" data-action="admin-review" data-id="${item.id}">${icon("message-square-warning")} Review</button>`
            : `<span class="pill">${icon("check")} Live</span>`
        }
      </div>
    </div>
  `;
}

function metric(label, value, iconName, hint) {
  return `
    <div class="metric-card">
      <div class="metric-top">
        <small>${label}</small>
        <span class="metric-icon">${icon(iconName)}</span>
      </div>
      <strong>${value}</strong>
      <span>${hint}</span>
    </div>
  `;
}

function renderTimeline(items) {
  return `
    <div class="timeline">
      ${items
        .map(
          (item) => `
            <div class="timeline-item">
              <span class="timeline-dot">${icon("leaf")}</span>
              <div class="timeline-card">
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.date)} - ${escapeHtml(item.body)}</p>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderChecklist(items) {
  return `
    <div class="check-list">
      ${items.map((item) => `<div>${icon("check-circle-2")} <span>${item}</span></div>`).join("")}
    </div>
  `;
}

function renderChart() {
  const bars = [
    ["Jan", 38],
    ["Feb", 52],
    ["Mar", 48],
    ["Apr", 64],
    ["May", 73],
    ["Jun", 88],
  ];
  return `
    <div class="chart">
      ${bars.map(([label, height]) => `<div class="bar-wrap"><div class="bar" style="height:${height}%"></div><span>${label}</span></div>`).join("")}
    </div>
  `;
}

function renderImpactSummary(totals) {
  return `
    <div class="revenue-model">
      <div class="split-ring">
        <span>${totals.available}</span>
        <strong>Open trees</strong>
      </div>
      <div class="split-copy">
        <div><b>${orchards.length}</b><span>published orchard profiles</span></div>
        <div><b>${totals.adopted}</b><span>trees already adopted across live farms</span></div>
        <div><b>${totals.trees}</b><span>total trees tracked in the current program data</span></div>
      </div>
    </div>
  `;
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
        })
        .join(","),
    )
    .join("\n");
}

function downloadTextFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}

function exportCsv(type) {
  if (type === "farmer-adoptions") {
    const rows = [
      ["Supporter", "Trees", "Date", "Status"],
      ["", "", "", "No adoption records yet"],
    ];
    return downloadTextFile("myorchard-farmer-adoptions.csv", toCsv(rows), "text/csv");
  }

  if (type === "admin-payments") {
    const rows = [
      ["Farm", "Farmer", "Adopted trees", "Total amount"],
      ...orchards
        .filter((farm) => Number(farm.adopted) > 0)
        .map((farm) => [farm.name, farm.farmer, String(farm.adopted), String((Number(farm.adopted) || 0) * programConfig.adoptionAmount)]),
    ];
    if (rows.length === 1) rows.push(["", "", "", "No payment records yet"]);
    return downloadTextFile("myorchard-admin-payments.csv", toCsv(rows), "text/csv");
  }

  return "";
}

function downloadCertificate() {
  const farm = selectedFarm();
  if (!farm) return "";
  const content = [
    "MYORCHARD CERTIFICATE OF TREE ADOPTION",
    "",
    `This is to certify that ${supporterDisplayName()} has adopted`,
    `${state.treeCount} Cashew Tree${state.treeCount > 1 ? "s" : ""}`,
    `from ${farm.name}, ${farm.district}, Maharashtra.`,
    "",
    "Date: 06 July 2026",
    `Certificate ID: MYO-${farm.id.toUpperCase()}-${state.treeCount}26`,
  ].join("\n");
  return downloadTextFile("myorchard-adoption-certificate.txt", content, "text/plain");
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;

  if (action === "choose-role") {
    state.role = target.dataset.role;
    state.teamAccessOpen = false;
    state.loginMessage = "";
    state.toast = "";
    if (state.role === "farmer" && !state.farmerSubmitted) state.farmerTab = "onboarding";
    render();
    return;
  }

  if (action === "toggle-team-access") {
    state.teamAccessOpen = !state.teamAccessOpen;
    state.loginMessage = "";
    render();
    return;
  }

  if (action === "team-login") {
    const email = state.loginEmail.trim().toLowerCase();
    if (state.adminEmails.includes(email)) {
      state.role = "admin";
      state.adminTab = "dashboard";
      state.teamAccessOpen = false;
      state.loginMessage = "";
    } else {
      state.loginMessage = "This email does not have team access.";
    }
    render();
    return;
  }

  if (action === "switch-role") {
    state.role = null;
    state.toast = "";
    render();
    return;
  }

  if (action === "export-csv") {
    const filename = exportCsv(target.dataset.export);
    if (filename) {
      state.toast = `${filename} downloaded`;
      render();
    }
    return;
  }

  if (action === "download-certificate") {
    const filename = downloadCertificate();
    state.toast = filename ? `${filename} downloaded` : "Choose a farm before downloading a certificate";
    render();
    return;
  }

  if (action === "nav") {
    const role = target.dataset.role;
    const tab = target.dataset.tab;
    state.toast = "";
    if (role === "farmer") state.farmerTab = tab;
    if (role === "supporter") state.supporterTab = tab;
    if (role === "admin") state.adminTab = tab;
    render();
    return;
  }

  if (action === "district-chip") {
    state.districtFilter = target.dataset.district;
    state.supporterTab = "orchards";
    render();
    return;
  }

  if (action === "clear-filters") {
    state.orchardSearch = "";
    state.districtFilter = "All";
    render();
    return;
  }

  if (action === "open-farm") {
    state.selectedFarmId = target.dataset.farm;
    state.supporterTab = "farm";
    render();
    return;
  }

  if (action === "start-adoption") {
    state.adoptionComplete = false;
    state.supporterTab = "adoption";
    render();
    return;
  }

  if (action === "tree-count") {
    state.treeCount = Math.max(1, Math.min(25, state.treeCount + Number(target.dataset.delta)));
    render();
    return;
  }

  if (action === "payment-method") {
    state.paymentMethod = target.dataset.method;
    render();
    return;
  }

  if (action === "complete-payment") {
    state.adoptionComplete = true;
    render();
    return;
  }

  if (action === "new-adoption") {
    state.adoptionComplete = false;
    state.treeCount = 1;
    state.supporterTab = "orchards";
    render();
    return;
  }

  if (action === "farmer-next") {
    state.farmerStep = Math.min(3, state.farmerStep + 1);
    render();
    return;
  }

  if (action === "farmer-back") {
    state.farmerStep = Math.max(0, state.farmerStep - 1);
    render();
    return;
  }

  if (action === "farmer-submit") {
    if (!farmerSubmissionReady()) {
      state.toast = "Complete farmer, orchard, tree, and bank details before submitting.";
      render();
      return;
    }
    upsertFarmerVerification();
    state.farmerSubmitted = true;
    state.farmerTab = "dashboard";
    state.toast = "Orchard submitted for verification";
    render();
    return;
  }

  if (action === "publish-update") {
    const title = document.querySelector('[data-field="newUpdateTitle"]')?.value.trim() || "Farm progress update";
    const body = state.updateDraft.trim();
    if (body) {
      state.farmerUpdates.unshift({
        title,
        date: "06 Jul 2026",
        body,
      });
      state.updateDraft = "";
      render();
    }
    return;
  }

  if (action === "admin-verify" || action === "admin-review") {
    const item = state.verifications.find((entry) => entry.id === target.dataset.id);
    if (item) item.status = action === "admin-verify" ? "Verified" : "Needs review";
    render();
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;

  if (target.dataset.field && target.dataset.field in state.farmerForm) {
    state.farmerForm[target.dataset.field] = target.value;
    return;
  }

  if (target.dataset.field === "updateDraft") {
    state.updateDraft = target.value;
    return;
  }

  if (target.dataset.field === "loginEmail") {
    state.loginEmail = target.value;
    state.loginMessage = "";
    return;
  }

  if (target.dataset.filter === "search") {
    state.orchardSearch = target.value;
    render(true);
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;

  if (target.dataset.field && target.dataset.field in state.farmerForm) {
    state.farmerForm[target.dataset.field] = target.value;
    return;
  }

  if (target.dataset.filter === "district") {
    state.districtFilter = target.value;
    render();
  }
});

supabaseBridge.init();
render();
supabaseBridge.sync().then(() => render());
