import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

function parseArgs(argv) {
  const out = { url: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--url") out.url = argv[++i];
    else if (a === "--out") out.outDir = argv[++i];
  }
  if (!out.url || !out.outDir) {
    throw new Error("Usage: node scripts/screenshot.mjs --url <url> --out <dir>");
  }
  return out;
}

const { url, outDir } = parseArgs(process.argv);
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

const outPath = path.join(outDir, "page.png");
await page.screenshot({ path: outPath, fullPage: true });

await context.close();
await browser.close();

console.log(outPath);
