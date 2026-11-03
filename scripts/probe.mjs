// node scripts/probe.mjs  (CI runs this once a day)
// Opens every listing's appUrl and records in probe.json when it last answered and since when it fails.
// build-index.mjs reads probe.json; a listing failing for 30 days goes into stale.txt for an issue.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { listingDirs, linkProblem } from "./check.mjs";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const file = join(root, "probe.json");
const DAY = 86_400_000;
const STALE_DAYS = 30;

export function nextRecord(previous, ok, now) {
  if (ok) return { lastOk: now, failingSince: null };
  return { lastOk: previous?.lastOk ?? null, failingSince: previous?.failingSince ?? now };
}

async function main() {
  const before = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const now = new Date().toISOString();
  const after = {};
  const stale = [];
  for (const { path, label } of listingDirs()) {
    const { appUrl } = JSON.parse(readFileSync(join(path, "listing.json"), "utf8"));
    // A bot block (401/403/429) still means the site is up.
    const problem = await linkProblem(appUrl);
    const record = nextRecord(before[label], !problem?.error, now);
    after[label] = record;
    if (record.failingSince && Date.parse(now) - Date.parse(record.failingSince) >= STALE_DAYS * DAY)
      stale.push(`${label}: ${appUrl} has failed since ${record.failingSince.slice(0, 10)} (${problem.error})`);
    console.log(`${problem?.error ? "✗" : "✓"} ${label}${problem?.error ? ` ${problem.error}` : ""}`);
  }
  writeFileSync(file, `${JSON.stringify(after, null, 2)}\n`);
  writeFileSync(join(root, "stale.txt"), stale.join("\n"));
}

if (process.argv[1]?.endsWith("probe.mjs")) main();
