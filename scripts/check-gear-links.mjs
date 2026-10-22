// Checks every gear product's manufacturer link and price date. Run before publishing gear data:
//   npm run data:gear-check
// Exits with 1 if a link does not answer with 2xx/3xx or a price was checked more than 12 months ago.
import { readFileSync } from "node:fs";

const { products } = JSON.parse(
  readFileSync(new URL("../data/gear.json", import.meta.url), "utf8"),
);
const staleBefore = new Date();
staleBefore.setUTCMonth(staleBefore.getUTCMonth() - 12);

let problems = 0;
for (const p of products) {
  let status;
  try {
    // GET, not HEAD: several manufacturer sites reject HEAD requests.
    const res = await fetch(p.sourceUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "FreerideAtlas link check" },
    });
    status = res.status;
  } catch (e) {
    status = `error: ${e instanceof Error ? e.message : e}`;
  }
  const linkOk = typeof status === "number" && status < 400;
  const priceOk = new Date(`${p.priceCheckedAt}T00:00:00Z`) >= staleBefore;
  if (!linkOk || !priceOk) problems++;
  console.log(
    `${linkOk && priceOk ? "ok  " : "FAIL"} ${p.id}: link ${status}${priceOk ? "" : `, price checked ${p.priceCheckedAt} (over 12 months)`}`,
  );
}
console.log(`${products.length} products, ${problems} with problems`);
process.exit(problems ? 1 : 0);
