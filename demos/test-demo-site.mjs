import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve, extname, sep } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(process.argv[2] || "site");
const types = { ".html": "text/html", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".pdf": "application/pdf", ".woff2": "font/woff2", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    const path = resolve(root, `.${decodeURIComponent(url.pathname)}`, url.pathname.endsWith("/") ? "index.html" : "");
    if (!path.startsWith(root + sep)) { response.writeHead(404); response.end(); return; }
    const body = await readFile(path);
    response.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(body);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(ready => server.listen(0, "127.0.0.1", ready));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
const externalRequests = [];
page.on("pageerror", error => errors.push(error.message));
await page.route("**/*", route => {
  const url = new URL(route.request().url());
  if (["http:", "https:"].includes(url.protocol) && url.origin !== origin) { externalRequests.push(url.origin); return route.abort(); }
  return route.continue();
});
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".demo").count(), 6);
  const links = await page.locator("a[href]").evaluateAll(elements => [...new Set(elements.map(element => element.getAttribute("href")).filter(href => !/^https?:/.test(href)))]);
  for (const link of links) assert.equal((await page.request.get(new URL(link, origin).href)).status(), 200, link);
  for (const [width, height] of [[1440, 1100], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    for (const image of await page.locator(".demo img").all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(element => element.decode());
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    const dimensions = await page.evaluate(() => ({ actual: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, loadedImages: [...document.images].filter(image => image.naturalWidth > 0).length }));
    assert.equal(dimensions.actual, width);
    assert.equal(dimensions.overflow, false);
    assert.equal(dimensions.loadedImages, 6);
    await page.screenshot({ path: join(root, "evidence", `gallery-${width}.png`), fullPage: true });
  }
  await page.getByRole("link", { name: "Open workspace: Form Desk", exact: true }).click();
  await page.locator("#export:not([disabled])").waitFor();
  assert.equal(await page.locator("#results tbody tr").count(), 3);
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  await writeFile(join(root, "evidence/gallery-verification.json"), JSON.stringify({ checkedAt: new Date().toISOString(), status: "PASS", demos: 6, checkedLinks: links.length, viewports: [1440, 390, 320], imagesLoaded: 6, interactiveDemoOpened: true, externalRequests, errors, syntheticOnly: true }, null, 2));
  console.log("PASS: gallery links, screenshots, assets, responsive layout and interactive demo navigation.");
} finally { await browser.close(); await new Promise(done => server.close(done)); }