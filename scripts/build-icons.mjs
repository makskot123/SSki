// Renders the app icons from one SVG with Playwright's Chromium (already a dev dependency).
// Run with: npm run icons
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(path.join(root, "package.json"))(
  "@playwright/test",
);

/** Dark slate square, snowy mountains, accent baseline. `scale` keeps maskable icons inside the safe zone. */
function svg({ radius, scale }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${radius}" fill="#0e1620"/>
  <g transform="translate(256 280) scale(${scale}) translate(-256 -280)">
    <polygon points="56,392 206,136 286,268 338,196 456,392" fill="#3b5a78"/>
    <polygon points="206,136 250,212 228,200 210,224 190,200 166,206" fill="#f4f8fb"/>
    <polygon points="338,196 368,248 352,240 338,254 324,240 312,240" fill="#f4f8fb"/>
    <rect x="56" y="392" width="400" height="22" rx="11" fill="#6cb4ff"/>
  </g>
</svg>`;
}

const outputs = [
  { file: "public/icons/icon-192.png", size: 192, radius: 96, scale: 1 },
  { file: "public/icons/icon-512.png", size: 512, radius: 96, scale: 1 },
  // Maskable: full-bleed background, artwork scaled into the central safe zone.
  { file: "public/icons/maskable-512.png", size: 512, radius: 0, scale: 0.72 },
  // iOS rounds the corners itself and does not want transparency.
  { file: "app/apple-icon.png", size: 180, radius: 0, scale: 0.86 },
  { file: "app/icon.png", size: 64, radius: 96, scale: 1 },
];

const browser = await chromium.launch();
for (const o of outputs) {
  const page = await browser.newPage({
    viewport: { width: o.size, height: o.size },
  });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(o).replace('width="512" height="512"', `width="${o.size}" height="${o.size}"`)}</body></html>`,
  );
  const target = path.join(root, o.file);
  mkdirSync(path.dirname(target), { recursive: true });
  await page.locator("svg").screenshot({ path: target, omitBackground: true });
  await page.close();
  console.log("wrote", o.file);
}
await browser.close();
