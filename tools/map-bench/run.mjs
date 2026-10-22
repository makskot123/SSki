// Dev tool: runs the 3D map benchmark matrix (profiles x configurations) in Playwright Chromium and
// prints one JSON line per run. Start server.mjs first. See README.md in this folder.
//
//   GPU=1      use the machine's real GPU (upper bound); default is SwiftShader software GL (worst case)
//   PROFILES   comma list: laptop,phone
//   CONFIGS    semicolon list: 2d | 3d-<aws|mh>-<pitch>-<exaggeration>-<dem maxzoom>
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const { chromium } = createRequire(path.join(project, "package.json"))(
  "@playwright/test",
);

const BASE = `http://localhost:${process.env.PORT ?? 4020}/`;
const gpuArgs =
  process.env.GPU === "1"
    ? [
        "--use-angle=d3d11",
        "--enable-gpu",
        "--ignore-gpu-blocklist",
        "--enable-unsafe-swiftshader",
      ]
    : ["--enable-unsafe-swiftshader"];

const profiles = {
  laptop: {
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    cpu: 1,
    net: null,
  },
  // Mid-range phone, emulated: phone screen and pixel density, 4x slower CPU, "fast 4G".
  // The GPU is NOT slowed down, so with GPU=1 frame rates are optimistic for a real phone.
  phone: {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    cpu: 4,
    net: {
      downloadThroughput: (9 * 1024 * 1024) / 8,
      uploadThroughput: (1.5 * 1024 * 1024) / 8,
      latency: 150,
    },
  },
};

const configs = (
  process.env.CONFIGS ??
  "2d;3d-aws-60-1.3-12;3d-aws-70-1.5-12;3d-aws-60-1.3-14;3d-mh-60-1.3-12"
).split(";");
const toQuery = (c) => {
  if (c === "2d") return "mode=2d";
  const [, dem, pitch, exag, demmax] = c.split("-");
  return `mode=3d&dem=${dem}&pitch=${pitch}&exag=${exag}&demmax=${demmax}`;
};

const browser = await chromium.launch({ args: gpuArgs });
for (const [name, p] of Object.entries(profiles)) {
  if (process.env.PROFILES && !process.env.PROFILES.split(",").includes(name))
    continue;
  for (const c of configs) {
    const context = await browser.newContext({
      viewport: p.viewport,
      deviceScaleFactor: p.deviceScaleFactor,
      isMobile: name === "phone",
      hasTouch: name === "phone",
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    if (p.cpu > 1)
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: p.cpu });
    if (p.net) {
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        ...p.net,
      });
    }

    const bytes = { dem: 0, basemap: 0, regions: 0, maplibre: 0, other: 0 };
    let demTiles = 0;
    page.on("response", async (r) => {
      const u = r.url();
      let size = Number(r.headers()["content-length"] ?? 0);
      if (!size) {
        try {
          size = (await r.body()).length;
        } catch {
          size = 0;
        }
      }
      if (/elevation-tiles|mapterhorn/.test(u)) {
        bytes.dem += size;
        demTiles++;
      } else if (/openfreemap/.test(u)) bytes.basemap += size;
      else if (/avalanche-regions/.test(u)) bytes.regions += size;
      else if (/maplibre/.test(u)) bytes.maplibre += size;
      else bytes.other += size;
    });

    const started = Date.now();
    try {
      await page.goto(BASE + "?" + toQuery(c), {
        waitUntil: "load",
        timeout: 120000,
      });
      await page.waitForFunction(() => window.ready === true, null, {
        timeout: 120000,
      });
      const result = await page.evaluate(() => window.runBench());
      const mb = (n) => +(n / 1048576).toFixed(2);
      console.log(
        JSON.stringify({
          profile: name,
          config: c,
          ...result,
          demTiles,
          MB: Object.fromEntries(
            Object.entries(bytes).map(([k, v]) => [k, mb(v)]),
          ),
          wallS: Math.round((Date.now() - started) / 1000),
        }),
      );
    } catch (e) {
      console.log(
        JSON.stringify({
          profile: name,
          config: c,
          error: String(e).slice(0, 200),
        }),
      );
    }
    await context.close();
  }
}
await browser.close();
