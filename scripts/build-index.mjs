// node scripts/build-index.mjs  (CI runs this after a merge)
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { listingDirs } from "./check.mjs";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const TOOLS = new Set(["wallet", "explorer", "analytics", "monitoring", "developer-tools", "infrastructure"]);
const image = (path, name) => {
  const file = ["png", "webp", "jpg"].map((ext) => join(path, `${name}.${ext}`)).find(existsSync);
  return relative(root, file).replace(/\\/g, "/");
};

const listings = listingDirs()
  .map(({ chain, path }) => {
    const { $schema, ...listing } = JSON.parse(readFileSync(join(path, "listing.json"), "utf8"));
    return { ...listing, chains: chain ? [chain] : listing.chains, group: TOOLS.has(listing.category) ? "tool" : "dapp", logo: image(path, "logo"), cover: image(path, "cover") };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

writeFileSync(join(root, "index.json"), `${JSON.stringify({ version: 1, listings }, null, 2)}\n`);
console.log(`index.json: ${listings.length} listings`);
