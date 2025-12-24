import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

function parseArgs(argv) {
  const out = {
    url: null,
    api: null,
    outDir: null,
    email: null,
    password: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--url") out.url = argv[++i];
    else if (a === "--api") out.api = argv[++i];
    else if (a === "--out") out.outDir = argv[++i];
    else if (a === "--email") out.email = argv[++i];
    else if (a === "--password") out.password = argv[++i];
  }

  if (!out.url || !out.outDir) {
    throw new Error(
      "Usage: node scripts/create-dashboard-and-screenshot.mjs --url <frontend_url> --out <dir> [--api <api_base_url>] [--email <email>] [--password <password>]"
    );
  }

  return out;
}

function buildBaseUrl(rawUrl) {
  const u = new URL(rawUrl);
  u.hash = "";
  u.search = "";
  // Normalize trailing slash away for predictable URL joins.
  u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

function apiUrl(apiBase, relativePath) {
  const base = apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
  return new URL(relativePath, base).toString();
}

async function fetchJson(url, { method, headers, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      (json && typeof json === "object" && "error" in json && json.error) ||
      text ||
      `${res.status} ${res.statusText}`;
    throw new Error(`${method || "GET"} ${url} failed: ${msg}`);
  }

  return json;
}

async function registerOrLogin({ apiBase, email, password, name }) {
  try {
    const reg = await fetchJson(apiUrl(apiBase, "auth/register"), {
      method: "POST",
      body: { email, password, name },
    });
    return reg.token;
  } catch (err) {
    const login = await fetchJson(apiUrl(apiBase, "auth/login"), {
      method: "POST",
      body: { email, password },
    });
    return login.token;
  }
}

async function createSavedQuery({ apiBase, token, name, queryText, description }) {
  return fetchJson(apiUrl(apiBase, "queries/saved"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { name, query_text: queryText, description },
  });
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

const { url: rawUrl, api: rawApi, outDir, email: rawEmail, password: rawPassword } = parseArgs(process.argv);

const url = buildBaseUrl(rawUrl);
const apiBase = buildBaseUrl(rawApi || new URL("/api", url).toString());

await fs.mkdir(outDir, { recursive: true });

const runId = Date.now().toString(36);
const email = rawEmail || `e2e+${runId}@example.com`;
const password = rawPassword || "password123!";
const userName = "E2E User";

const token = await registerOrLogin({ apiBase, email, password, name: userName });

const savedQueryName = `Top cities by population (${runId})`;
const savedQueryText = `
SELECT name AS city, population
FROM mysql.world.city
ORDER BY population DESC
LIMIT 10
`.trim();

await createSavedQuery({
  apiBase,
  token,
  name: savedQueryName,
  queryText: savedQueryText,
  description: "Sample query for dashboard widget",
});

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

await context.addInitScript((t) => {
  window.localStorage.setItem("token", t);
}, token);

const page = await context.newPage();

const dashboardsUrl = new URL("/dashboards", url).toString();
await page.goto(dashboardsUrl, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Dashboards", exact: true }).waitFor({ timeout: 60_000 });

await page.getByRole("button", { name: "New Dashboard" }).first().click();
await page.locator("h2", { hasText: "Create Dashboard" }).waitFor({ timeout: 30_000 });

const dashboardName = `MySQL World Dashboard (${runId})`;
await page.getByPlaceholder("Dashboard name").fill(dashboardName);
await page.getByPlaceholder("Description").fill("Auto-created by Playwright");

await page.getByRole("button", { name: "Create" }).click();
await page.waitForURL(/\/dashboards\/[0-9a-f-]+/i, { timeout: 60_000 });
await page.getByRole("heading", { name: dashboardName }).waitFor({ timeout: 60_000 });

await page.getByRole("button", { name: "Add Widget" }).click();

const dialogTitle = page.locator("h2", { hasText: "Add Widget" });
await dialogTitle.waitFor({ timeout: 30_000 });
const dialog = dialogTitle.locator('xpath=ancestor::div[contains(@class,"max-w-lg")]').first();

await dialog.getByPlaceholder("Widget name").fill("Top Cities");
await dialog
  .locator("label", { hasText: "Saved Query" })
  .locator("..")
  .locator("select")
  .selectOption({ label: savedQueryName });
await dialog
  .locator("label", { hasText: "Chart Type" })
  .locator("..")
  .locator("select")
  .selectOption({ value: "bar" });

const widgetCreated = page.waitForResponse(
  (res) =>
    res.request().method() === "POST" &&
    res.status() === 201 &&
    new URL(res.url()).pathname.match(/^\/api\/dashboards\/[^/]+\/widgets$/)
);
await dialog.getByRole("button", { name: "Add Widget" }).click();
await widgetCreated;

await page.waitForResponse(
  (res) =>
    res.request().method() === "POST" &&
    res.status() === 200 &&
    new URL(res.url()).pathname === "/api/queries/execute",
  { timeout: 60_000 }
);

await page.locator("canvas").first().waitFor({ timeout: 60_000 });
await page.waitForTimeout(500);

const outPath = path.join(outDir, "dashboard.png");
await page.screenshot({ path: outPath, fullPage: true });

await context.close();
await browser.close();

console.log(outPath);
