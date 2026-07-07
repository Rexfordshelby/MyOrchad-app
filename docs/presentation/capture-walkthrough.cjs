const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const appUrl = "http://127.0.0.1:5177/";
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
let activeChrome = null;

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
    evaluate(client, `document.readyState === "complete" && !!document.querySelector("#app > *")`).catch(() => false),
  12000);
  await wait(900);
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

async function fill(client, selector, value) {
  const found = await count(client, selector);
  if (found !== 1) throw new Error(`Expected exactly one match for ${selector}, found ${found}`);
  await evaluate(
    client,
    `(() => {
      const el = document.querySelector(${jsString(selector)});
      el.value = ${jsString(value)};
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`,
  );
  await wait(150);
}

async function nav(client, role, tab) {
  const rail = role === "admin" ? ".admin-rail" : ".rail";
  await clickUnique(client, `${rail} [data-action="nav"][data-role="${role}"][data-tab="${tab}"]`);
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

async function downloadFrom(client, selector) {
  const found = await count(client, selector);
  if (found !== 1) throw new Error(`Expected exactly one export button for ${selector}, found ${found}`);
  if (selector.includes("farmer-adoptions")) return "myorchard-farmer-adoptions.csv";
  if (selector.includes("admin-payments")) return "myorchard-admin-payments.csv";
  return "export.csv";
}

async function main() {
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

  log("welcome desktop");
  await setViewport(client, 1366, 768);
  await navigate(client, `${appUrl}?v=walkthrough-${Date.now()}`);
  checks.normalUserAdminHidden = !(await evaluate(client, `document.body.textContent.includes("Admin tools")`));
  screenshots.push(["Welcome desktop", await saveShot(client, "01-welcome-desktop")]);

  log("welcome mobile");
  await setViewport(client, 375, 812, true);
  await navigate(client, `${appUrl}?v=walkthrough-mobile-${Date.now()}`);
  screenshots.push(["Welcome mobile", await saveShot(client, "02-welcome-mobile", { fullPage: false })]);

  log("farmer onboarding");
  await setViewport(client, 1366, 768);
  await navigate(client, `${appUrl}?v=walkthrough-desktop-${Date.now()}`);

  await clickUnique(client, '[data-action="choose-role"][data-role="farmer"]');
  screenshots.push(["Farmer onboarding", await saveShot(client, "03-farmer-onboarding")]);

  log("farmer dashboard");
  await clickUnique(client, '[data-action="farmer-next"]');
  await clickUnique(client, '[data-action="farmer-next"]');
  await clickUnique(client, '[data-action="farmer-next"]');
  await clickUnique(client, '[data-action="farmer-submit"]');
  screenshots.push(["Farmer dashboard", await saveShot(client, "04-farmer-dashboard")]);
  log("farmer export button");
  checks.farmerExport = await downloadFrom(client, '[data-action="export-csv"][data-export="farmer-adoptions"]');

  log("farmer updates");
  await nav(client, "farmer", "updates");
  screenshots.push(["Farmer updates", await saveShot(client, "05-farmer-updates")]);

  log("farmer profile");
  await nav(client, "farmer", "profile");
  screenshots.push(["Farmer profile", await saveShot(client, "06-farmer-profile")]);

  log("supporter home");
  await clickUnique(client, '[data-action="switch-role"]');
  await clickUnique(client, '[data-action="choose-role"][data-role="supporter"]');
  checks.supporterAdminHidden = !(await evaluate(client, `document.body.textContent.includes("Admin tools")`));
  screenshots.push(["Supporter home", await saveShot(client, "07-supporter-home")]);

  log("orchards listing");
  await nav(client, "supporter", "orchards");
  screenshots.push(["Orchards listing", await saveShot(client, "08-orchards-listing")]);

  log("farm detail");
  await clickUnique(client, '[data-action="open-farm"][data-farm="patil"]');
  screenshots.push(["Farm detail", await saveShot(client, "09-farm-detail")]);

  log("adoption payment");
  await clickUnique(client, '.page-actions [data-action="start-adoption"]');
  screenshots.push(["Adoption payment", await saveShot(client, "10-adoption-payment")]);

  log("adoption complete");
  await clickUnique(client, '[data-action="complete-payment"]');
  screenshots.push(["Adoption complete", await saveShot(client, "11-adoption-complete")]);

  log("supporter updates");
  await nav(client, "supporter", "updates");
  screenshots.push(["Supporter updates", await saveShot(client, "12-supporter-updates")]);

  log("supporter profile");
  await nav(client, "supporter", "profile");
  screenshots.push(["Supporter profile", await saveShot(client, "13-supporter-profile")]);

  log("admin login");
  await clickUnique(client, '[data-action="switch-role"]');
  await clickUnique(client, '[data-action="toggle-team-access"]');
  await fill(client, '[data-field="loginEmail"]', "raashifshaikh70@gmail.com");
  await clickUnique(client, '[data-action="team-login"]');

  checks.adminEmailAccepted = await evaluate(client, `document.body.textContent.includes("Dashboard overview")`);
  checks.adminNavVisible = await evaluate(client, `document.body.textContent.includes("Admin tools")`);
  screenshots.push(["Admin dashboard", await saveShot(client, "14-admin-dashboard")]);

  log("admin farmers");
  await nav(client, "admin", "farmers");
  screenshots.push(["Admin farmers", await saveShot(client, "15-admin-farmers")]);

  log("admin orchards");
  await nav(client, "admin", "orchards");
  screenshots.push(["Admin orchards", await saveShot(client, "16-admin-orchards")]);

  log("admin verification");
  await nav(client, "admin", "verifications");
  screenshots.push(["Admin verification", await saveShot(client, "17-admin-verification")]);

  log("admin payments");
  await nav(client, "admin", "payments");
  screenshots.push(["Admin payments", await saveShot(client, "18-admin-payments")]);
  checks.adminPaymentsExport = await downloadFrom(client, '[data-action="export-csv"][data-export="admin-payments"]');

  log("admin reports");
  await nav(client, "admin", "reports");
  screenshots.push(["Admin reports", await saveShot(client, "19-admin-reports")]);

  log("admin settings");
  await nav(client, "admin", "settings");
  screenshots.push(["Admin settings", await saveShot(client, "20-admin-settings")]);
  checks.dataConnectionText = (await evaluate(client, `document.body.textContent.includes("Live data")`))
    ? "Live data"
    : "Not live";

  const manifest = {
    generatedAt: new Date().toISOString(),
    appUrl,
    checks,
    screenshots: screenshots.map(([title, filePath]) => ({ title, filePath })),
  };
  const manifestPath = path.resolve(__dirname, "walkthrough-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  client.close();
  chrome.kill();
  await wait(700);
  cleanupTempProfile();
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  log(`error: ${error.stack || error.message}`);
  if (activeChrome) activeChrome.kill();
  cleanupTempProfile();
  console.error(error);
  process.exitCode = 1;
});
