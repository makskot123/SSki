// MapLibre's web worker cannot be bundled by Next/Turbopack ("Worker failed to load"), so it is
// served as a plain static file and registered with setWorkerUrl(). Copying it from node_modules
// on every dev/build keeps it in sync with the installed maplibre-gl version.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const from = fileURLToPath(
  new URL(
    "../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ),
);
const dir = fileURLToPath(new URL("../public/maplibre/", import.meta.url));

mkdirSync(dir, { recursive: true });
copyFileSync(from, `${dir}maplibre-gl-worker.mjs`);
console.log("copied maplibre-gl-worker.mjs to public/maplibre/");
