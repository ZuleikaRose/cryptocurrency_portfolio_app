// Renders the ERD page from erd.py to a PNG at 1.5x, the scale drawsql.png uses.
// Usage: node render.mjs in.html out.png
import { chromium } from "playwright";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error("Usage: node render.mjs in.html out.png");
  process.exit(1);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1.5 });
  await page.goto(pathToFileURL(resolve(input)).href);
  // Size the viewport to the SVG so the screenshot has no margins.
  const size = await page.evaluate(() => {
    const svg = document.querySelector("svg");
    return svg ? { width: Number(svg.getAttribute("width")), height: Number(svg.getAttribute("height")) } : null;
  });
  if (!size) throw new Error(`No <svg> found in ${input}`);
  await page.setViewportSize(size);
  await page.screenshot({ path: output, fullPage: true });
  console.log(`Wrote ${output} (${Math.round(size.width * 1.5)} px wide)`);
} catch (error) {
  console.error(`Couldn't render ${input}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
