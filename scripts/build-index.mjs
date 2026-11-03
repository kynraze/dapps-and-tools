// node scripts/build-index.mjs  (CI runs this after a merge and after the daily probe)
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import { listingDirs } from "./check.mjs";
import { decodePng, edgeColour } from "./png.mjs";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const TOOLS = new Set(["wallet", "explorer", "analytics", "monitoring", "developer-tools", "infrastructure"]);
// A listing whose app has failed the daily probe for this long is shown as not responding.
const DOWN_AFTER_MS = 3 * 86_400_000;
const file = (path, name, exts) => exts.map((ext) => join(path, `${name}.${ext}`)).find(existsSync);
const rel = (path) => relative(root, path).replace(/\\/g, "/");
// Pins image URLs to the commit that holds them: CI sets GITHUB_SHA, a local run asks git.
const commit = process.env.GITHUB_SHA || execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
const probe = existsSync(join(root, "probe.json")) ? JSON.parse(readFileSync(join(root, "probe.json"), "utf8")) : {};

const listings = listingDirs()
  .map(({ id, chain, path, label }) => {
    const { $schema, ...listing } = JSON.parse(readFileSync(join(path, "listing.json"), "utf8"));
    const logo = file(path, "logo", ["png"]);
    const cover = file(path, "cover", ["png", "webp", "jpg"]);
    let tint = null;
    try { tint = edgeColour(decodePng(readFileSync(logo))); } catch { /* not decodable here: no tint */ }
    const failingSince = probe[label]?.failingSince;
    const down = Boolean(failingSince) && Date.now() - Date.parse(failingSince) >= DOWN_AFTER_MS;
    return {
      id,
      ...listing,
      chains: chain ? [chain] : listing.chains,
      group: TOOLS.has(listing.category) ? "tool" : "dapp",
      logo: rel(logo),
      ...(cover ? { cover: rel(cover) } : {}),
      ...(tint ? { logoTint: tint } : {}),
      ...(down ? { down: true } : {}),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

writeFileSync(join(root, "index.json"), `${JSON.stringify({ version: 1, commit, listings }, null, 2)}\n`);
console.log(`index.json: ${listings.length} listings`);
