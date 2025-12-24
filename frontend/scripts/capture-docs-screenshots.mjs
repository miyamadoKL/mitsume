import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

function parseArgs(argv) {
  const out = {
    url: null,
    api: null,
    outDir: null,
    email: "docs@example.com",
    password: "password123!",
    name: "Docs User",
    adminToken: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--url") out.url = argv[++i];
    else if (a === "--api") out.api = argv[++i];
    else if (a === "--out") out.outDir = argv[++i];
    else if (a === "--email") out.email = argv[++i];
    else if (a === "--password") out.password = argv[++i];
    else if (a === "--name") out.name = argv[++i];
    else if (a === "--admin-token") out.adminToken = argv[++i];
  }

  if (!out.url || !out.outDir) {
    throw new Error(
      "Usage: node scripts/capture-docs-screenshots.mjs --url <frontend_url> --out <dir> [--api <api_base_url>] [--email <email>] [--password <password>] [--name <name>] [--admin-token <jwt>]"
    );
  }

  return out;
}

function buildBaseUrl(rawUrl) {
  const u = new URL(rawUrl);
  u.hash = "";
  u.search = "";
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
  } catch {
    const login = await fetchJson(apiUrl(apiBase, "auth/login"), {
      method: "POST",
      body: { email, password },
    });
    return login.token;
  }
}

async function listResources({ apiBase, token, path }) {
  return fetchJson(apiUrl(apiBase, path), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function createNotificationChannel({ apiBase, token, name }) {
  return fetchJson(apiUrl(apiBase, "notification-channels"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name,
      channel_type: "slack",
      config: { webhook_url: "https://hooks.slack.com/services/TEST/TEST/TEST" },
    },
  });
}

async function createSavedQuery({ apiBase, token, name, queryText, description }) {
  return fetchJson(apiUrl(apiBase, "queries/saved"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { name, query_text: queryText, description },
  });
}

async function createDashboard({ apiBase, token, name, description }) {
  return fetchJson(apiUrl(apiBase, "dashboards"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { name, description },
  });
}

async function createWidget({ apiBase, token, dashboardId, name, queryId, chartType, position }) {
  return fetchJson(apiUrl(apiBase, `dashboards/${dashboardId}/widgets`), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name,
      query_id: queryId,
      chart_type: chartType,
      chart_config: {},
      position,
    },
  });
}

async function createAlert({
  apiBase,
  token,
  name,
  queryId,
  conditionColumn,
  conditionOperator,
  conditionValue,
  aggregation,
  checkIntervalMinutes,
  cooldownMinutes,
  channelIds,
}) {
  return fetchJson(apiUrl(apiBase, "alerts"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: {
      query_id: queryId,
      name,
      description: "Auto-created for docs screenshots",
      condition_column: conditionColumn,
      condition_operator: conditionOperator,
      condition_value: conditionValue,
      aggregation,
      check_interval_minutes: checkIntervalMinutes,
      cooldown_minutes: cooldownMinutes,
      channel_ids: channelIds,
    },
  });
}

async function createSubscription({
  apiBase,
  token,
  name,
  dashboardId,
  scheduleCron,
  timezone,
  format,
  channelIds,
}) {
  return fetchJson(apiUrl(apiBase, "subscriptions"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: {
      dashboard_id: dashboardId,
      name,
      schedule_cron: scheduleCron,
      timezone,
      format,
      channel_ids: channelIds,
    },
  });
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

async function newAuthedContext(browser, token) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((t) => {
    window.localStorage.setItem("token", t);
  }, token);
  return context;
}

async function screenshotPage({ page, baseUrl, route, waitFor, outPath }) {
  const targetUrl = new URL(route, baseUrl).toString();
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  if (waitFor) {
    await waitFor();
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: outPath, fullPage: true });
}

async function runQueryForScreenshot(page) {
  // Focus Monaco editor and run a simple query.
  const query = `
SELECT name AS city, population
FROM city
ORDER BY population DESC
LIMIT 10
`.trim();

  const editor = page.locator('[aria-roledescription="editor"]').first();
  await editor.click({ force: true });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(query, { delay: 5 });

  const execResponse = page.waitForResponse((res) => {
    try {
      return (
        res.request().method() === "POST" &&
        new URL(res.url()).pathname === "/api/queries/execute"
      );
    } catch {
      return false;
    }
  });

  await page.getByRole("button", { name: "Execute" }).click();
  const res = await execResponse;
  if (!res.ok()) {
    throw new Error(`Query execute failed: ${res.status()} ${res.statusText()}`);
  }

  await page.locator("text=/\\d+ rows in/").waitFor({ timeout: 60_000 });
}

async function main() {
  const args = parseArgs(process.argv);
  const baseUrl = buildBaseUrl(args.url);
  const apiBase = buildBaseUrl(args.api || new URL("/api", baseUrl).toString());

  await fs.mkdir(args.outDir, { recursive: true });

  const token = await registerOrLogin({
    apiBase,
    email: args.email,
    password: args.password,
    name: args.name,
  });

  // Ensure sample resources exist (idempotent-ish by name for this user).
  const channels = await listResources({ apiBase, token, path: "notification-channels" });
  const channelName = "docs-slack";
  const channel =
    channels.find((c) => c.name === channelName) ||
    (await createNotificationChannel({ apiBase, token, name: channelName }));

  const savedQueries = await listResources({ apiBase, token, path: "queries/saved" });
  const savedQueryName = "Top Cities by Population";
  const savedQueryText = `
SELECT name AS city, population
FROM mysql.world.city
ORDER BY population DESC
LIMIT 10
`.trim();

  const savedQuery =
    savedQueries.find((q) => q.name === savedQueryName) ||
    (await createSavedQuery({
      apiBase,
      token,
      name: savedQueryName,
      queryText: savedQueryText,
      description: "Sample query for docs screenshots",
    }));

  const dashboards = await listResources({ apiBase, token, path: "dashboards" });
  const dashboardName = "World Dashboard";
  const dashboard =
    dashboards.find((d) => d.name === dashboardName) ||
    (await createDashboard({
      apiBase,
      token,
      name: dashboardName,
      description: "Sample dashboard for docs screenshots",
    }));

  const dashboardDetail = await fetchJson(apiUrl(apiBase, `dashboards/${dashboard.id}`), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const widgetName = "Top Cities";
  const hasWidget = (dashboardDetail.widgets || []).some((w) => w.name === widgetName);
  if (!hasWidget) {
    await createWidget({
      apiBase,
      token,
      dashboardId: dashboard.id,
      name: widgetName,
      queryId: savedQuery.id,
      chartType: "bar",
      position: { x: 0, y: 0, w: 6, h: 3 },
    });
  }

  const alerts = await listResources({ apiBase, token, path: "alerts" });
  const alertName = "Population Spike Alert";
  if (!alerts.some((a) => a.name === alertName)) {
    await createAlert({
      apiBase,
      token,
      name: alertName,
      queryId: savedQuery.id,
      conditionColumn: "population",
      conditionOperator: "gt",
      conditionValue: "10000000",
      aggregation: "max",
      checkIntervalMinutes: 1440,
      cooldownMinutes: 1440,
      channelIds: [channel.id],
    });
  }

  const subscriptions = await listResources({ apiBase, token, path: "subscriptions" });
  const subscriptionName = "Weekly World Dashboard";
  if (!subscriptions.some((s) => s.name === subscriptionName)) {
    await createSubscription({
      apiBase,
      token,
      name: subscriptionName,
      dashboardId: dashboard.id,
      scheduleCron: "0 9 * * 1",
      timezone: "Asia/Tokyo",
      format: "image",
      channelIds: [channel.id],
    });
  }

  const browser = await launchBrowser();

  // User-facing screenshots (non-admin user keeps the sidebar minimal).
  const userContext = await newAuthedContext(browser, token);
  const userPage = await userContext.newPage();

  await screenshotPage({
    page: userPage,
    baseUrl,
    route: "/query",
    waitFor: async () => {
      await userPage.getByRole("heading", { name: "Query Editor", exact: true }).waitFor({ timeout: 60_000 });
      await runQueryForScreenshot(userPage);
    },
    outPath: path.join(args.outDir, "query-editor.png"),
  });

  await screenshotPage({
    page: userPage,
    baseUrl,
    route: "/saved",
    waitFor: async () => {
      await userPage.getByRole("heading", { name: "Saved Queries", exact: true }).waitFor({ timeout: 60_000 });
      await userPage.getByText(savedQueryName).first().waitFor({ timeout: 60_000 });
    },
    outPath: path.join(args.outDir, "saved-queries.png"),
  });

  await screenshotPage({
    page: userPage,
    baseUrl,
    route: "/dashboards",
    waitFor: async () => {
      await userPage.getByRole("heading", { name: "Dashboards", exact: true }).waitFor({ timeout: 60_000 });
      await userPage.getByText(dashboardName).first().waitFor({ timeout: 60_000 });
    },
    outPath: path.join(args.outDir, "dashboards.png"),
  });

  await screenshotPage({
    page: userPage,
    baseUrl,
    route: `/dashboards/${dashboard.id}`,
    waitFor: async () => {
      await userPage.getByRole("heading", { name: dashboardName }).waitFor({ timeout: 60_000 });
      await userPage.locator("canvas").first().waitFor({ timeout: 60_000 });
    },
    outPath: path.join(args.outDir, "dashboard-detail.png"),
  });

  await screenshotPage({
    page: userPage,
    baseUrl,
    route: "/alerts",
    waitFor: async () => {
      await userPage.getByRole("heading", { name: "Alerts", exact: true }).waitFor({ timeout: 60_000 });
      await userPage.getByText(alertName).first().waitFor({ timeout: 60_000 });
    },
    outPath: path.join(args.outDir, "alerts.png"),
  });

  await screenshotPage({
    page: userPage,
    baseUrl,
    route: "/subscriptions",
    waitFor: async () => {
      await userPage.getByRole("heading", { name: "Subscriptions", exact: true }).waitFor({ timeout: 60_000 });
      await userPage.getByText(subscriptionName).first().waitFor({ timeout: 60_000 });
    },
    outPath: path.join(args.outDir, "subscriptions.png"),
  });

  await screenshotPage({
    page: userPage,
    baseUrl,
    route: "/notifications",
    waitFor: async () => {
      await userPage.getByRole("heading", { name: "Notification Channels", exact: true }).waitFor({ timeout: 60_000 });
      await userPage.getByText(channelName).first().waitFor({ timeout: 60_000 });
    },
    outPath: path.join(args.outDir, "notification-channels.png"),
  });

  // Overall layout screenshot for docs/README.md (re-use query page).
  await screenshotPage({
    page: userPage,
    baseUrl,
    route: "/query",
    waitFor: async () => {
      await userPage.getByRole("heading", { name: "Query Editor", exact: true }).waitFor({ timeout: 60_000 });
    },
    outPath: path.join(args.outDir, "app-layout.png"),
  });

  await userContext.close();

  // Admin screenshots (optional).
  if (args.adminToken) {
    const adminContext = await newAuthedContext(browser, args.adminToken);
    const adminPage = await adminContext.newPage();

    await screenshotPage({
      page: adminPage,
      baseUrl,
      route: "/admin/roles",
      waitFor: async () => {
        await adminPage.getByRole("heading", { name: "Role Management", exact: true }).waitFor({ timeout: 60_000 });
      },
      outPath: path.join(args.outDir, "admin-role-management.png"),
    });

    await screenshotPage({
      page: adminPage,
      baseUrl,
      route: "/admin/users",
      waitFor: async () => {
        await adminPage.getByRole("heading", { name: "User Management", exact: true }).waitFor({ timeout: 60_000 });
      },
      outPath: path.join(args.outDir, "admin-user-management.png"),
    });

    await adminContext.close();
  }

  await browser.close();

  console.log(`Saved screenshots to ${args.outDir}`);
}

await main();
