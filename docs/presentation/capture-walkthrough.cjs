const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const outputDir = path.resolve(__dirname, "screenshots");
const downloadsDir = path.resolve(__dirname, "downloads");
const logPath = path.resolve(__dirname, "capture.log");
const userDataDir = path.join(os.tmpdir(), `myorchard-chrome-${Date.now()}`);
const chromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const screens = [
  {
    file: "01-welcome-desktop",
    title: "Welcome desktop",
    scenario: "welcome",
    viewport: [1366, 768, false],
    purpose: "Introduces MyOrchard, shows the brand, explains trust context, and starts farmer/supporter account access without exposing admin tools.",
    buttons: [
      "EN / Marathi: switches interface language.",
      "Farmer / Supporter role cards: preselect the account type.",
      "Sign in / Sign up: changes the account mode.",
      "Continue/Create account: sends the user into Supabase Auth.",
    ],
  },
  {
    file: "02-welcome-mobile",
    title: "Welcome mobile",
    scenario: "welcome",
    viewport: [375, 812, true],
    fullPage: false,
    purpose: "Confirms the first screen fits the phone frame with the visual, brand, role choices, and account access stacked cleanly.",
    buttons: [
      "Language switch: keeps Marathi/English reachable on phone.",
      "Farmer / Supporter: selects the path before account creation.",
      "Continue/Create account: moves into the chosen role after login.",
    ],
  },
  {
    file: "03-farmer-onboarding",
    title: "Farmer onboarding",
    scenario: "farmer-onboarding",
    viewport: [1366, 768, false],
    purpose: "Collects farmer identity, KYC, orchard details, and review information before admin verification.",
    buttons: [
      "Back / Next: moves through the four-step verification form.",
      "Submit for verification: sends the completed farmer record to the verification queue.",
      "Sign out: returns to the public welcome screen.",
    ],
  },
  {
    file: "04-farmer-dashboard",
    title: "Farmer dashboard",
    scenario: "farmer-dashboard",
    viewport: [1366, 768, false],
    purpose: "Gives the farmer a status view of trees, verification progress, adoptions, and activity.",
    buttons: [
      "Upload update: opens the farm update composer.",
      "Export: downloads farmer adoption records as CSV.",
      "Left navigation: moves between dashboard, orchard, updates, and profile.",
    ],
  },
  {
    file: "05-farmer-updates",
    title: "Farmer updates",
    scenario: "farmer-updates",
    viewport: [1366, 768, false],
    purpose: "Lets farmers publish orchard progress notes and attach photo names for supporters.",
    buttons: [
      "Add photos: opens the image file chooser.",
      "Publish update: saves the field note to the updates flow.",
      "Navigation buttons: return to farmer dashboard/profile/onboarding.",
    ],
  },
  {
    file: "06-farmer-profile",
    title: "Farmer profile",
    scenario: "farmer-profile",
    viewport: [1366, 768, false],
    purpose: "Shows the farmer identity, profile health, private payout details, orchard information, and trust checklist.",
    buttons: [
      "Edit: returns to onboarding so details can be corrected.",
      "Post update: opens the update composer.",
      "Sign out: exits the farmer account.",
    ],
  },
  {
    file: "07-supporter-home",
    title: "Supporter home",
    scenario: "supporter-home",
    viewport: [1366, 768, false],
    purpose: "Starts the supporter journey with live orchard availability, impact context, and recommended farms.",
    buttons: [
      "Find orchards: opens searchable orchard listings.",
      "District chips: filter toward a district.",
      "View all: shows every available orchard.",
    ],
  },
  {
    file: "08-orchards-listing",
    title: "Orchards listing",
    scenario: "supporter-orchards",
    viewport: [1366, 768, false],
    purpose: "Lets supporters search, filter, and inspect verified orchards before adoption.",
    buttons: [
      "Search field: filters by farm, farmer, or district.",
      "District dropdown: filters by launch district.",
      "Reset: clears search and district filters.",
      "View farm: opens detailed farm information.",
    ],
  },
  {
    file: "09-farm-details",
    title: "Farm details",
    scenario: "supporter-farm",
    viewport: [1366, 768, false],
    purpose: "Shows a selected farm with farmer name, location, tree availability, verification signals, and adoption entry points.",
    buttons: [
      "Back: returns to the orchard list.",
      "Adopt trees / Adopt from this farm: starts checkout for the selected orchard.",
    ],
  },
  {
    file: "10-supporter-adoption",
    title: "Supporter adoption checkout",
    scenario: "supporter-adoption",
    viewport: [1366, 768, false],
    purpose: "Handles tree quantity, payment method, supporter details, total amount, and checkout confirmation.",
    buttons: [
      "Minus / Plus: changes the tree count.",
      "UPI / Card / Net banking: selects payment method.",
      "Pay: records adoption and prepares certificate.",
    ],
  },
  {
    file: "11-certificate",
    title: "Certificate",
    scenario: "supporter-certificate",
    viewport: [1366, 768, false],
    purpose: "Confirms adoption completion and provides the downloadable certificate and update timeline.",
    buttons: [
      "Adopt another tree: resets the adoption flow.",
      "Download certificate: downloads the certificate text file.",
    ],
  },
  {
    file: "12-supporter-updates",
    title: "Supporter updates",
    scenario: "supporter-updates",
    viewport: [1366, 768, false],
    purpose: "Tracks adoption milestones and farmer update timing after a tree is adopted.",
    buttons: [
      "Bottom/side navigation: switches to orchards, adoption, or profile.",
      "Sign out: exits the supporter account.",
    ],
  },
  {
    file: "13-supporter-profile",
    title: "Supporter profile",
    scenario: "supporter-profile",
    viewport: [1366, 768, false],
    purpose: "Keeps supporter identity, contact details, adoption history, certificates, and saved farms in one clean profile.",
    buttons: [
      "Edit: opens profile editing fields.",
      "Adopt: returns to the orchard list.",
      "Browse: opens farm discovery from saved farms.",
    ],
  },
  {
    file: "14-admin-dashboard",
    title: "Admin dashboard",
    scenario: "admin-dashboard",
    viewport: [1366, 768, false],
    purpose: "Only appears for approved team email access and summarizes farmer review, orchards, tree inventory, adoptions, and verification tasks.",
    buttons: [
      "Open: jumps to verification queue.",
      "Admin navigation: moves across farmers, orchards, verify, payments, reports, and settings.",
      "Sign out: locks admin navigation again.",
    ],
  },
  {
    file: "15-admin-farmers",
    title: "Admin farmers",
    scenario: "admin-farmers",
    viewport: [1366, 768, false],
    purpose: "Lists farmer submissions, KYC state, payout readiness, and review status.",
    buttons: [
      "Admin navigation: changes admin section.",
      "Sign out: exits admin access.",
    ],
  },
  {
    file: "16-admin-orchards",
    title: "Admin orchards",
    scenario: "admin-orchards",
    viewport: [1366, 768, false],
    purpose: "Shows public orchard inventory from approved records so admin can monitor tree availability and listings.",
    buttons: [
      "View farm: opens the farm detail pattern for review.",
      "Admin navigation: moves to verification, payments, reports, and settings.",
    ],
  },
  {
    file: "17-admin-verification",
    title: "Admin verification queue",
    scenario: "admin-verification",
    viewport: [1366, 768, false],
    purpose: "Lets admin approve or send farmer submissions back for review before public listing.",
    buttons: [
      "Approve: marks the submission verified and prepares an orchard listing.",
      "Review: marks the submission as needing review.",
    ],
  },
  {
    file: "18-admin-payments",
    title: "Admin payments",
    scenario: "admin-payments",
    viewport: [1366, 768, false],
    purpose: "Tracks collected adoption payments, receipts, certificates, and farmer review counts.",
    buttons: [
      "Export CSV: downloads payment records for operations.",
      "Admin navigation: moves to reports or settings.",
    ],
  },
  {
    file: "19-admin-reports",
    title: "Admin reports",
    scenario: "admin-reports",
    viewport: [1366, 768, false],
    purpose: "Summarizes adoption progress, available inventory, farmer income, and monthly trend.",
    buttons: [
      "Admin navigation: switches report context.",
      "Sign out: leaves management mode.",
    ],
  },
  {
    file: "20-admin-settings",
    title: "Admin settings",
    scenario: "admin-settings",
    viewport: [1366, 768, false],
    purpose: "Controls launch settings such as adoption amount, crop focus, verification rules, update rhythm, and districts.",
    buttons: [
      "Save settings: writes settings through the admin-only settings path.",
      "Language switch: changes admin language.",
    ],
  },
  {
    file: "21-mobile-supporter-home",
    title: "Mobile supporter home",
    scenario: "supporter-home",
    viewport: [390, 844, true],
    fullPage: false,
    purpose: "Confirms the signed-in supporter experience fits a phone viewport with topbar, metrics, and bottom navigation.",
    buttons: [
      "Bottom navigation: keeps Home, Orchards, Adoption, Updates, and Profile reachable on mobile.",
      "Find orchards: opens farm discovery.",
    ],
  },
  {
    file: "22-mobile-admin-dashboard",
    title: "Mobile admin dashboard",
    scenario: "admin-dashboard",
    viewport: [390, 844, true],
    fullPage: false,
    purpose: "Confirms admin navigation and dashboard metrics remain usable on a narrow screen after approved email login.",
    buttons: [
      "Bottom admin navigation: moves between admin sections.",
      "Open: jumps into verification work.",
    ],
  },
];

let activeChrome = null;
let activeServer = null;

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.rmSync(downloadsDir, { recursive: true, force: true });
fs.mkdirSync(downloadsDir, { recursive: true });
fs.writeFileSync(logPath, "");

function findBrowser() {
  const browserPath = chromePaths.find((candidate) => fs.existsSync(candidate));
  if (!browserPath) throw new Error("No Chrome or Edge executable found.");
  return browserPath;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
  const line = `[capture] ${new Date().toISOString()} ${message}\n`;
  fs.appendFileSync(logPath, line);
  console.error(line.trim());
}

function cleanupTempProfile() {
  try {
    fs.rmSync(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  } catch (error) {
    log(`cleanup skipped: ${error.message}`);
  }
}

async function waitFor(predicate, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await wait(100);
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function captureHarnessSource() {
  return `
;(() => {
  const sampleOrchards = () => [
    {
      id: "gaonkar-cashew",
      name: "Gaonkar Cashew Orchard",
      farmer: "Sanjay Gaonkar",
      district: "Sindhudurg",
      village: "Vengurla",
      state: "Maharashtra",
      acres: "3.2",
      totalTrees: 620,
      adopted: 184,
      available: 436,
      rating: "4.9",
      income: 920000,
      image: assets.cover,
      coordinates: "15.8621 N, 73.6317 E",
      summary: "A verified cashew orchard with geo-tagged trees and monthly progress reporting.",
    },
    {
      id: "jadhav-orchard",
      name: "Jadhav Coastal Farm",
      farmer: "Meera Jadhav",
      district: "Ratnagiri",
      village: "Dapoli",
      state: "Maharashtra",
      acres: "2.4",
      totalTrees: 410,
      adopted: 96,
      available: 314,
      rating: "4.8",
      income: 480000,
      image: assets.supporter,
      coordinates: "17.7581 N, 73.1852 E",
      summary: "A family-run orchard connected to supporters through certificates and update records.",
    },
    {
      id: "patil-hill-farm",
      name: "Patil Hill Cashew Farm",
      farmer: "Vilas Patil",
      district: "Kolhapur",
      village: "Ajra",
      state: "Maharashtra",
      acres: "4.1",
      totalTrees: 780,
      adopted: 210,
      available: 570,
      rating: "4.7",
      income: 1050000,
      image: assets.trust,
      coordinates: "16.1209 N, 74.2104 E",
      summary: "A larger verified orchard with clean inventory and adoption-ready tree records.",
    },
  ];

  const sampleVerifications = () => [
    {
      id: "verify-gaonkar",
      userId: "farmer-capture",
      farmer: "Sanjay Gaonkar",
      farm: "Gaonkar Cashew Orchard",
      district: "Sindhudurg",
      village: "Vengurla",
      acres: "3.2",
      crop: "Cashew",
      mobile: "90000 00000",
      bank: "Konkan Cooperative Bank",
      account: "XXXX 2451",
      status: "Pending",
      trees: 620,
      createdAt: new Date().toISOString(),
    },
    {
      id: "verify-jadhav",
      userId: "farmer-jadhav",
      farmer: "Meera Jadhav",
      farm: "Jadhav Coastal Farm",
      district: "Ratnagiri",
      village: "Dapoli",
      acres: "2.4",
      crop: "Cashew",
      mobile: "91111 11111",
      bank: "Ratnagiri Bank",
      account: "XXXX 8122",
      status: "Needs review",
      trees: 410,
      createdAt: new Date().toISOString(),
    },
    {
      id: "verify-patil",
      userId: "farmer-patil",
      farmer: "Vilas Patil",
      farm: "Patil Hill Cashew Farm",
      district: "Kolhapur",
      village: "Ajra",
      acres: "4.1",
      crop: "Cashew",
      mobile: "92222 22222",
      bank: "Kolhapur Bank",
      account: "XXXX 9002",
      status: "Verified",
      trees: 780,
      createdAt: new Date().toISOString(),
    },
  ];

  const sampleAdoptions = () => [
    {
      id: "adopt-001",
      supporterName: "Aarav Deshmukh",
      orchardSlug: "gaonkar-cashew",
      treeCount: 3,
      totalAmount: 15000,
      paymentMethod: "UPI",
      status: "Paid",
      certificateId: "MYO-GAONKAR-003",
      createdAt: new Date().toISOString(),
      month: new Date().toISOString().slice(0, 7),
    },
    {
      id: "adopt-002",
      supporterName: "Neha Kulkarni",
      orchardSlug: "jadhav-orchard",
      treeCount: 2,
      totalAmount: 10000,
      paymentMethod: "Card",
      status: "Paid",
      certificateId: "MYO-JADHAV-002",
      createdAt: new Date().toISOString(),
      month: new Date().toISOString().slice(0, 7),
    },
  ];

  const sampleUpdates = () => [
    {
      title: "Flowering stage completed",
      date: "08 Jul 2026",
      body: "The orchard completed flowering and the farmer uploaded the first progress note for supporters.",
      photos: ["flowering-row.jpg", "tree-health.jpg"],
    },
    {
      title: "Tree health inspection",
      date: "01 Jul 2026",
      body: "Field team reviewed sample trees and confirmed the next update window.",
      photos: ["inspection.jpg"],
    },
  ];

  function seedCommon() {
    setLanguage("en", false);
    orchards.splice(0, orchards.length, ...sampleOrchards());
    state.verifications = sampleVerifications();
    state.adoptions = sampleAdoptions();
    state.farmerUpdates = sampleUpdates();
    state.toast = "";
    state.authMessage = "";
    state.authBusy = false;
    state.authEmail = "";
    state.authPassword = "";
    state.authName = "";
    state.profileEditMode = false;
    state.treeCount = 3;
    state.paymentMethod = "UPI";
    state.selectedFarmId = "gaonkar-cashew";
    state.adoptionRecord = sampleAdoptions()[0];
    state.updateTitle = "Flowering stage completed";
    state.updateDraft = "Flowering is complete and the trees are ready for the next inspection cycle.";
    state.updatePhotos = ["flowering-row.jpg", "leaf-check.jpg"];
    state.paymentForm = { supporterName: "Aarav Deshmukh", mobile: "98888 12345" };
    state.supporterProfile = {
      name: "Aarav Deshmukh",
      handle: "@aaravplants",
      mobile: "98888 12345",
      email: "aarav@example.com",
      location: "Mumbai, Maharashtra",
      bio: "Supports verified orchard families and tracks every adoption certificate in one place.",
    };
    state.supporterProfileDraft = {
      name: "Aarav Deshmukh",
      mobile: "98888 12345",
      location: "Mumbai, Maharashtra",
      bio: "Supports verified orchard families and tracks every adoption certificate in one place.",
    };
    state.farmerForm = {
      fullName: "Sanjay Gaonkar",
      mobile: "90000 00000",
      aadhaar: "XXXX-XXXX-2451",
      district: "Sindhudurg",
      village: "Vengurla",
      orchardName: "Gaonkar Cashew Orchard",
      acres: "3.2",
      totalTrees: "620",
      crop: "Cashew",
      ownership: "Owned",
      bank: "Konkan Cooperative Bank",
      account: "XXXX 2451",
    };
    state.farmerProfile = {
      handle: "@gaonkarcashew",
      location: "Vengurla, Sindhudurg",
      bio: "Verified cashew farmer preparing orchard details for supporter adoption.",
    };
    state.settingsDraft = {
      adoptionAmount: "5000",
      cropFocus: "Cashew",
      verificationRequirement: "KYC, location, tree count",
      updateFrequency: "Monthly",
      launchDistricts: "Sindhudurg, Ratnagiri, Kolhapur",
    };
    programConfig.adoptionAmount = 5000;
    supabaseBridge.status = "live";
    supabaseBridge.dataSource = "Supabase live data";
    supabaseBridge.lastSync = "08 Jul, 07:30 pm";
    supabaseBridge.message = "Admin email access, farmer verification, adoptions, certificates, updates, and settings are mapped to Supabase tables.";
  }

  function setSession(role) {
    const email = role === "admin"
      ? "raashifshaikh70@gmail.com"
      : role === "farmer"
        ? "sanjay.farmer@example.com"
        : "aarav.supporter@example.com";
    const name = role === "admin" ? "Raashif Shaikh" : role === "farmer" ? "Sanjay Gaonkar" : "Aarav Deshmukh";
    state.session = { userId: "capture-" + role, email, name, role };
    state.role = role;
  }

  function setScenario(name) {
    seedCommon();

    if (name === "welcome") {
      state.role = null;
      state.session = null;
      state.adoptionComplete = false;
      render();
      return true;
    }

    if (name.startsWith("farmer-")) {
      setSession("farmer");
      state.farmerSubmitted = name !== "farmer-onboarding";
      state.farmerStep = name === "farmer-onboarding" ? 2 : 3;
      state.farmerTab = name.replace("farmer-", "");
      if (state.farmerTab === "onboarding") state.farmerSubmitted = false;
      render();
      return true;
    }

    if (name.startsWith("supporter-")) {
      setSession("supporter");
      state.adoptionComplete = !["supporter-home", "supporter-orchards", "supporter-farm", "supporter-adoption"].includes(name);
      if (name === "supporter-home") state.supporterTab = "home";
      if (name === "supporter-orchards") state.supporterTab = "orchards";
      if (name === "supporter-farm") state.supporterTab = "farm";
      if (name === "supporter-adoption") {
        state.supporterTab = "adoption";
        state.adoptionComplete = false;
      }
      if (name === "supporter-certificate") {
        state.supporterTab = "adoption";
        state.adoptionComplete = true;
      }
      if (name === "supporter-updates") state.supporterTab = "updates";
      if (name === "supporter-profile") state.supporterTab = "profile";
      render();
      return true;
    }

    if (name.startsWith("admin-")) {
      setSession("admin");
      const tabName = name.replace("admin-", "");
      state.adminTab = tabName === "verification" ? "verifications" : tabName;
      render();
      return true;
    }

    render();
    return false;
  }

  window.__myOrchardCapture = {
    setScenario,
    checks() {
      return {
        adminEmail: "raashifshaikh70@gmail.com",
        adminAllowlist: state.adminEmails.includes("raashifshaikh70@gmail.com"),
        adminNavVisible: Boolean(document.querySelector(".admin-rail")),
        adminToolsText: document.body.textContent.includes("Admin tools"),
      };
    },
  };
})();
`;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
      const filePath = path.resolve(repoRoot, pathname.replace(/^\/+/, ""));
      if (!filePath.startsWith(repoRoot)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.setHeader("Content-Type", contentType(filePath));
      res.setHeader("Cache-Control", "no-store");
      if (path.basename(filePath) === "app.js") {
        res.end(fs.readFileSync(filePath, "utf8") + captureHarnessSource());
        return;
      }
      res.end(fs.readFileSync(filePath));
    });
    server.listen(0, "127.0.0.1", () => {
      activeServer = server;
      const { port } = server.address();
      resolve({ server, appUrl: `http://127.0.0.1:${port}/` });
    });
  });
}

function launchChrome() {
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(findBrowser(), [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1366,768",
    "about:blank",
  ], { stdio: "ignore" });

  chrome.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`Chrome exited with code ${code}`);
    }
  });

  activeChrome = chrome;
  return { chrome, port };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
      this.ws.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (!message.id) return;
        const deferred = this.pending.get(message.id);
        if (!deferred) return;
        this.pending.delete(message.id);
        if (message.error) {
          deferred.reject(new Error(message.error.message));
        } else {
          deferred.resolve(message.result || {});
        }
      });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 15000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.ws.send(payload);
    });
  }

  close() {
    this.ws.close();
  }
}

function jsString(value) {
  return JSON.stringify(value);
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Evaluation failed");
  }
  return result.result?.value;
}

async function setViewport(client, width, height, mobile = false) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  await waitFor(() =>
    evaluate(client, `document.readyState === "complete" && !!window.__myOrchardCapture`).catch(() => false),
  12000);
  await wait(400);
}

async function count(client, selector) {
  return evaluate(client, `document.querySelectorAll(${jsString(selector)}).length`);
}

async function clickUnique(client, selector) {
  const found = await count(client, selector);
  if (found !== 1) throw new Error(`Expected exactly one match for ${selector}, found ${found}`);
  const rect = await evaluate(
    client,
    `(() => {
      const el = document.querySelector(${jsString(selector)});
      el.scrollIntoView({ block: "center", inline: "center" });
      const box = el.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })()`,
  );
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: rect.x,
    y: rect.y,
    button: "none",
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: rect.x,
    y: rect.y,
    button: "left",
    clickCount: 1,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: rect.x,
    y: rect.y,
    button: "left",
    clickCount: 1,
  });
  await wait(350);
}

async function invokeButton(client, selector) {
  const found = await count(client, selector);
  if (found !== 1) throw new Error(`Expected exactly one match for ${selector}, found ${found}`);
  await evaluate(
    client,
    `(() => {
      const el = document.querySelector(${jsString(selector)});
      el.scrollIntoView({ block: "center", inline: "center" });
      el.click();
      return true;
    })()`,
  );
  await wait(500);
}

async function saveShot(client, name, options = {}) {
  await evaluate(client, "window.scrollTo(0, 0); true");
  await wait(250);
  let params = { format: "png", fromSurface: true };
  if (options.fullPage !== false) {
    const metrics = await client.send("Page.getLayoutMetrics");
    const width = Math.ceil(metrics.cssContentSize.width);
    const height = Math.ceil(metrics.cssContentSize.height);
    params = {
      ...params,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    };
  }
  const result = await client.send("Page.captureScreenshot", params);
  const filePath = path.join(outputDir, `${name}.png`);
  fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
  return filePath;
}

async function setScenario(client, name) {
  const ok = await evaluate(client, `window.__myOrchardCapture.setScenario(${jsString(name)})`);
  if (!ok) throw new Error(`Unknown scenario: ${name}`);
  await wait(350);
}

async function waitForDownload(fileName, timeoutMs = 8000) {
  const filePath = path.join(downloadsDir, fileName);
  await waitFor(() => {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    return stat.size > 0 && !fs.existsSync(`${filePath}.crdownload`);
  }, timeoutMs);
  return filePath;
}

async function verifyDownloads(client) {
  const checks = {};
  log("verifying farmer CSV export");
  await setScenario(client, "farmer-dashboard");
  await invokeButton(client, '[data-action="export-csv"][data-export="farmer-adoptions"]');
  checks.farmerExport = await waitForDownload("myorchard-farmer-adoptions.csv");

  log("verifying admin payments CSV export");
  await setScenario(client, "admin-payments");
  await invokeButton(client, '[data-action="export-csv"][data-export="admin-payments"]');
  checks.adminPaymentsExport = await waitForDownload("myorchard-admin-payments.csv");

  log("verifying certificate download");
  await setScenario(client, "supporter-certificate");
  await invokeButton(client, '[data-action="download-certificate"]');
  checks.certificateDownload = await waitForDownload("myorchard-adoption-certificate.txt");

  return checks;
}

async function main() {
  const { appUrl } = await startServer();
  const { chrome, port } = launchChrome();
  const base = `http://127.0.0.1:${port}`;
  log("waiting for browser");
  await waitFor(() => fetchJson(`${base}/json/version`).catch(() => null), 12000);

  log("opening target");
  const target = await fetchJson(`${base}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadsDir,
  }).catch(() => {});

  const screenshots = [];
  const checks = {};

  for (const screen of screens) {
    log(screen.title);
    const [width, height, mobile] = screen.viewport;
    await setViewport(client, width, height, mobile);
    await navigate(client, `${appUrl}?capture=${encodeURIComponent(screen.scenario)}&v=${Date.now()}`);
    await setScenario(client, screen.scenario);
    const pathName = await saveShot(client, screen.file, { fullPage: screen.fullPage });
    const screenChecks = await evaluate(client, "window.__myOrchardCapture.checks()");
    screenshots.push({ ...screen, filePath: pathName, checks: screenChecks });
  }

  await setViewport(client, 1366, 768, false);
  await navigate(client, `${appUrl}?capture=checks&v=${Date.now()}`);
  await setScenario(client, "welcome");
  checks.normalUserAdminHidden = !(await evaluate(client, `document.body.textContent.includes("Admin tools")`));
  await setScenario(client, "supporter-home");
  checks.supporterAdminHidden = !(await evaluate(client, `document.body.textContent.includes("Admin tools")`));
  await setScenario(client, "admin-dashboard");
  checks.adminEmailAssigned = await evaluate(client, `window.__myOrchardCapture.checks().adminAllowlist`);
  checks.adminEmailVisibleInTopbar = await evaluate(client, `document.body.textContent.includes("raashifshaikh70@gmail.com")`);
  checks.adminNavVisible = await evaluate(client, `document.body.textContent.includes("Admin tools")`);
  Object.assign(checks, await verifyDownloads(client));

  const manifest = {
    generatedAt: new Date().toISOString(),
    appUrl,
    adminEmail: "raashifshaikh70@gmail.com",
    checks,
    screenshots,
  };
  const manifestPath = path.resolve(__dirname, "walkthrough-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  client.close();
  chrome.kill();
  activeServer?.close();
  await wait(700);
  cleanupTempProfile();
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  log(`error: ${error.stack || error.message}`);
  if (activeChrome) activeChrome.kill();
  if (activeServer) activeServer.close();
  cleanupTempProfile();
  console.error(error);
  process.exitCode = 1;
});
