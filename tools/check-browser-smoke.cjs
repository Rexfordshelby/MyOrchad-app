const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const userDataDir = path.join(os.tmpdir(), `myorchard-smoke-${Date.now()}`);
const chromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

let activeServer;
let activeChrome;

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function findBrowser() {
  const browserPath = chromePaths.find((candidate) => fs.existsSync(candidate));
  if (!browserPath) throw new Error("No Chrome or Edge executable found for browser smoke checks.");
  return browserPath;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await wait(100);
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
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
      res.end(fs.readFileSync(filePath));
    });

    server.listen(0, "127.0.0.1", () => {
      activeServer = server;
      resolve(`http://127.0.0.1:${server.address().port}/`);
    });
  });
}

function launchChrome() {
  const port = 9600 + Math.floor(Math.random() * 400);
  activeChrome = spawn(findBrowser(), [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1366,768",
    "about:blank",
  ], { stdio: "ignore" });
  return port;
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
    this.handlers = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
      this.ws.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (!message.id) {
          const handlers = this.handlers.get(message.method) || [];
          handlers.forEach((handler) => handler(message.params || {}));
          return;
        }
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

  on(method, handler) {
    this.handlers.set(method, [...(this.handlers.get(method) || []), handler]);
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
    this.ws?.close();
  }
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
    evaluate(
      client,
      `document.readyState === "complete" && !!window.MyOrchardSupabase && document.querySelector("#app")?.children.length > 0`,
    ).catch(() => false),
  12000);
  await waitFor(() =>
    evaluate(client, `["schema", "live", "empty"].includes(window.MyOrchardSupabase?.status)`).catch(() => false),
  15000).catch(() => {});
  await wait(900);
}

async function click(client, selector) {
  const count = await evaluate(client, `document.querySelectorAll(${JSON.stringify(selector)}).length`);
  if (count !== 1) throw new Error(`Expected one element for ${selector}, found ${count}`);
  await evaluate(
    client,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      el.scrollIntoView({ block: "center", inline: "center" });
      el.click();
      return true;
    })()`,
  );
  await wait(350);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function snapshot(client) {
  return evaluate(
    client,
    `(() => {
      const visible = (el) => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
      };
      const visibleActions = [...document.querySelectorAll("[data-action]")].filter(visible);
      const h1 = document.querySelector("h1");
      const roleCards = [...document.querySelectorAll('[data-action="choose-role"]')].filter(visible);
      const authTabs = [...document.querySelectorAll('[data-action="auth-mode"]')].filter(visible);
      return {
        viewport: { width: innerWidth, height: innerHeight },
        documentLang: document.documentElement.lang,
        activeLanguage: document.querySelector(".lang-btn.active")?.dataset.lang || "",
        storedLanguage: localStorage.getItem("myorchard_language") || "",
        hasDevanagari: /[\\u0900-\\u097F]/.test(document.body.textContent || ""),
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        adminToolsVisible: document.body.textContent.includes("Admin tools"),
        h1Visible: visible(h1),
        h1Text: h1?.textContent?.trim() || "",
        roleCardsVisible: roleCards.length,
        authTabsVisible: authTabs.length,
        visibleActions: visibleActions.length,
        languageButtons: [...document.querySelectorAll('[data-action="language"]')].filter(visible).map((el) => el.dataset.lang),
        supabaseStatus: window.MyOrchardSupabase?.status || "",
        authSubmitDisabled: Boolean(document.querySelector('[data-action="auth-submit"]')?.disabled),
        authMessageText: document.querySelector(".auth-message")?.textContent?.trim() || "",
        brokenImages: [...document.images].filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.getAttribute("src") || img.currentSrc),
        consoleStatus: window.MyOrchardSupabase?.dataSource || "",
      };
    })()`,
  );
}

function validateWelcomeState(state, label) {
  assert(!state.overflowX, `${label}: horizontal overflow (${state.scrollWidth}px > viewport ${state.viewport.width}px)`);
  assert(!state.adminToolsVisible, `${label}: public welcome screen exposes admin tools`);
  assert(state.h1Visible && state.h1Text.includes("MyOrchard"), `${label}: welcome headline is not visible`);
  assert(state.roleCardsVisible >= 2, `${label}: farmer/supporter role cards are not visible`);
  assert(state.authTabsVisible >= 2, `${label}: sign-in/sign-up tabs are not visible`);
  assert(state.visibleActions >= 6, `${label}: too few visible actions`);
  assert(state.languageButtons.includes("en") && state.languageButtons.includes("mr"), `${label}: language buttons are missing`);
  assert(state.brokenImages.length === 0, `${label}: broken images detected: ${state.brokenImages.join(", ")}`);
  if (state.supabaseStatus === "schema") {
    assert(state.authSubmitDisabled, `${label}: auth submit should be disabled while backend schema setup is missing`);
    assert(state.authMessageText.includes("Backend setup"), `${label}: backend setup message is missing`);
  }
}

function cleanup() {
  try {
    activeChrome?.kill();
  } catch {}
  try {
    activeServer?.close();
  } catch {}
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {}
}

async function main() {
  const appUrl = await startServer();
  const port = launchChrome();
  const base = `http://127.0.0.1:${port}`;
  await waitFor(() => fetchJson(`${base}/json/version`).catch(() => null), 12000);

  const target = await fetchJson(`${base}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  const client = new CdpClient(target.webSocketDebuggerUrl);
  const browserErrors = [];
  client.on("Runtime.exceptionThrown", (params) => browserErrors.push(params.exceptionDetails?.text || "Runtime exception"));
  client.on("Runtime.consoleAPICalled", (params) => {
    if (params.type === "error") browserErrors.push((params.args || []).map((arg) => arg.value || arg.description || "").join(" "));
  });
  client.on("Log.entryAdded", (params) => {
    if (/Failed to load resource/i.test(params.entry?.text || "")) return;
    if (params.entry?.level === "error") browserErrors.push(params.entry.text || "Browser log error");
  });

  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable").catch(() => {});

  const results = [];
  for (const viewport of [
    { label: "desktop", width: 1366, height: 768, mobile: false },
    { label: "mobile", width: 390, height: 844, mobile: true },
  ]) {
    await setViewport(client, viewport.width, viewport.height, viewport.mobile);
    await navigate(client, appUrl);
    const state = await snapshot(client);
    validateWelcomeState(state, viewport.label);
    results.push({ label: viewport.label, ...state });
  }

  await click(client, '[data-action="language"][data-lang="mr"]');
  const marathi = await snapshot(client);
  assert(marathi.documentLang === "mr", "Marathi switch did not update document lang");
  assert(marathi.activeLanguage === "mr", "Marathi switch did not mark Marathi active");
  assert(marathi.storedLanguage === "mr", "Marathi switch did not persist language");
  assert(marathi.hasDevanagari, "Marathi switch did not render Devanagari text");

  await click(client, '[data-action="language"][data-lang="en"]');
  const english = await snapshot(client);
  assert(english.documentLang === "en", "English switch did not restore document lang");
  assert(english.activeLanguage === "en", "English switch did not mark English active");
  assert(english.storedLanguage === "en", "English switch did not persist language");

  assert(browserErrors.length === 0, `Browser console/runtime errors: ${browserErrors.join(" | ")}`);

  client.close();
  cleanup();

  console.log("MyOrchard browser smoke check");
  console.log("");
  for (const result of results) {
    console.log(`[OK] ${result.label}: ${result.viewport.width}x${result.viewport.height}, actions ${result.visibleActions}, scroll ${result.scrollWidth}x${result.scrollHeight}`);
  }
  console.log("[OK] Public users do not see admin tools");
  if (results.some((result) => result.supabaseStatus === "schema" && result.authSubmitDisabled)) {
    console.log("[OK] Account access is guarded while backend schema setup is incomplete");
  } else {
    console.log("[OK] Account access is open because backend schema setup did not report issues");
  }
  console.log("[OK] Marathi and English language switches update UI, persistence, and document lang");
  console.log("[OK] No browser console/runtime errors");
}

main().catch((error) => {
  cleanup();
  console.error(error.message || error);
  process.exit(1);
});
