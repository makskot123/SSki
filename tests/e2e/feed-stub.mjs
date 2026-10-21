// Local stand-in for the avalanche feeds, used only by the e2e tests.
// It serves RECORDED real bulletins (tests/fixtures/avalanche) with every timestamp shifted so the
// newest publication is "two hours ago". Nothing is invented: only the clock is moved.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) =>
  JSON.parse(
    readFileSync(path.join(here, "../fixtures/avalanche", name), "utf8"),
  );

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function newestPublication(json) {
  return Math.max(...json.bulletins.map((b) => Date.parse(b.publicationTime)));
}

function shiftTimes(value, deltaMs) {
  if (typeof value === "string")
    return ISO.test(value)
      ? new Date(Date.parse(value) + deltaMs).toISOString()
      : value;
  if (Array.isArray(value)) return value.map((v) => shiftTimes(v, deltaMs));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, shiftTimes(v, deltaMs)]),
    );
  }
  return value;
}

function redated(name) {
  const json = fixture(name);
  if (json.bulletins.length === 0) return json;
  const target = Date.now() - 2 * 3_600_000;
  return shiftTimes(json, target - newestPublication(json));
}

const routes = {
  "/euregio.json": () => redated("tyrol-2026-02-15.json"),
  "/slf.json": () => redated("slf-2026-02-15.json"),
};

const port = Number(process.env.E2E_FEED_PORT ?? 4010);
createServer((req, res) => {
  const route = routes[new URL(req.url ?? "/", "http://localhost").pathname];
  if (!route) {
    res.writeHead(404).end("not found");
    return;
  }
  res
    .writeHead(200, { "content-type": "application/json" })
    .end(JSON.stringify(route()));
}).listen(port, () => console.log(`avalanche feed stub on :${port}`));
