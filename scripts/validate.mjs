// Checks every listing against schema/listing.schema.json, chains.json and the image rules.
// `--links` also requests every URL. No dependencies: Node 20 or later.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const schema = JSON.parse(readFileSync(join(root, "schema/listing.schema.json"), "utf8"));
const chains = new Set(JSON.parse(readFileSync(join(root, "chains.json"), "utf8")));
const props = schema.properties;
const checkLinks = process.argv.includes("--links");

const IMAGES = {
  logo: { maxBytes: 200 * 1024, check: (w, h) => (w !== h ? "must be square" : w < 96 ? "must be at least 96 px" : null) },
  cover: { maxBytes: 500 * 1024, check: (w) => (w < 1000 ? "must be at least 1000 px wide" : null) },
};

/** Width and height from a PNG, JPEG or WebP header; null for anything else. */
export function imageSize(buffer) {
  if (buffer.readUInt32BE(0) === 0x89504e47) return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X") return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
    if (chunk === "VP8L") { const b = buffer.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
    if (chunk === "VP8 ") return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff];
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    for (let i = 2; i < buffer.length - 9;) {
      const marker = buffer[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [buffer.readUInt16BE(i + 7), buffer.readUInt16BE(i + 5)];
      i += 2 + buffer.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** Every listing directory: chains/<chain>/<id> (chain from the folder) and shared/<id> (chains in the file). */
export function listingDirs(base = root) {
  const subdirs = (path) => existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  return [
    ...subdirs(join(base, "chains")).flatMap((chain) => subdirs(join(base, "chains", chain)).map((id) => ({ id, chain, path: join(base, "chains", chain, id), label: `chains/${chain}/${id}` }))),
    ...subdirs(join(base, "shared")).map((id) => ({ id, chain: null, path: join(base, "shared", id), label: `shared/${id}` })),
  ];
}

export function listingErrors(listing, dir, chain = null) {
  const errors = [];
  const add = (message) => errors.push(message);
  for (const key of Object.keys(listing)) if (!props[key]) add(`unknown field "${key}"`);
  for (const key of schema.required) if (listing[key] == null) add(`missing "${key}"`);
  const text = (key) => {
    const value = listing[key], rule = props[key];
    if (value == null) return;
    if (typeof value !== "string") return add(`"${key}" must be a string`);
    if (rule.minLength && value.length < rule.minLength) add(`"${key}" is shorter than ${rule.minLength} characters`);
    if (rule.maxLength && value.length > rule.maxLength) add(`"${key}" is longer than ${rule.maxLength} characters`);
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) add(`"${key}" does not match ${rule.pattern}`);
  };
  ["id", "name", "description", "appUrl", "coverPosition"].forEach(text);
  for (const key of ["category", "network", "status"]) if (listing[key] != null && !props[key].enum.includes(listing[key])) add(`"${key}" must be one of ${props[key].enum.join(", ")}`);
  if (listing.id !== dir) add(`"id" must equal its directory name "${dir}"`);
  if (typeof listing.description === "string" && (listing.description.match(/[.!?](\s|$)/g) ?? []).length > 2) add(`"description" has more than two sentences`);
  if (listing.status !== "sunset" && !listing.appUrl) add(`"appUrl" is required unless the status is sunset`);
  if (chain) {
    if (!chains.has(chain)) add(`folder chains/${chain} is not a chain in chains.json`);
    if (listing.chains != null) add(`"chains" belongs only in shared/; this listing takes its chain from the folder`);
  } else if (!Array.isArray(listing.chains) || listing.chains.length < 2) add(`a shared listing needs "chains" with two or more chains; a single-chain listing goes in chains/<chain>/`);
  else for (const name of listing.chains) if (!chains.has(name)) add(`unknown chain "${name}" (see chains.json)`);
  const linkKinds = props.links.items.properties.kind.enum;
  for (const [i, link] of (listing.links ?? []).entries()) {
    if (!linkKinds.includes(link?.kind)) add(`links[${i}].kind must be one of ${linkKinds.join(", ")}`);
    if (typeof link?.href !== "string" || !link.href.startsWith("https://")) add(`links[${i}].href must start with https://`);
    for (const key of Object.keys(link ?? {})) if (!["kind", "href"].includes(key)) add(`links[${i}] has unknown field "${key}"`);
  }
  const explorerKinds = props.explorer.items.properties.kind.enum;
  for (const [i, item] of (listing.explorer ?? []).entries()) {
    if (!explorerKinds.includes(item?.kind)) add(`explorer[${i}].kind must be one of ${explorerKinds.join(", ")}`);
    if (["validator", "account"].includes(item?.kind) && !item.address) add(`explorer[${i}] needs "address"`);
    if (item?.kind === "analytics" && !item.topic) add(`explorer[${i}] needs "topic"`);
    for (const key of Object.keys(item ?? {})) if (!["kind", "address", "topic"].includes(key)) add(`explorer[${i}] has unknown field "${key}"`);
  }
  const handle = new RegExp(props.maintainers.items.pattern);
  if (!Array.isArray(listing.maintainers) || !listing.maintainers.length) add(`"maintainers" needs at least one GitHub handle`);
  else for (const name of listing.maintainers) if (!handle.test(name)) add(`maintainer "${name}" is not a GitHub handle`);
  return errors;
}

function imageErrors(dir) {
  const errors = [];
  for (const [name, rule] of Object.entries(IMAGES)) {
    const file = ["png", "webp", "jpg"].map((ext) => join(dir, `${name}.${ext}`)).find(existsSync);
    if (!file) { errors.push(`missing ${name}.png, ${name}.webp or ${name}.jpg`); continue; }
    const bytes = statSync(file).size;
    if (bytes > rule.maxBytes) errors.push(`${name} is ${Math.round(bytes / 1024)} KB, over ${rule.maxBytes / 1024} KB`);
    const size = imageSize(readFileSync(file));
    if (!size) { errors.push(`${name} is not a readable PNG, WebP or JPEG`); continue; }
    const problem = rule.check(...size);
    if (problem) errors.push(`${name} (${size.join("×")}) ${problem}`);
  }
  return errors;
}

/** 401/403/429 often mean a site that blocks bots (x.com, t.me), so they warn instead of failing. */
async function linkProblem(url) {
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "Mozilla/5.0 (dapps-and-tools link check)" } });
    if ([401, 403, 429].includes(response.status)) return { warn: `${url} answered ${response.status}` };
    if (!response.ok) return { error: `${url} answered ${response.status}` };
    const site = (host) => host.replace(/^www\./, "").split(".").slice(-2).join(".");
    if (site(new URL(response.url).hostname) !== site(new URL(url).hostname)) return { error: `${url} redirects to ${response.url}` };
    return null;
  } catch (error) {
    return { error: `${url} failed: ${error.cause?.code ?? error.message}` };
  }
}

async function main() {
  const dirs = listingDirs();
  const seen = new Map();
  let failed = 0;
  for (const { id: dir, chain, path, label } of dirs) {
    let listing, errors;
    try { listing = JSON.parse(readFileSync(join(path, "listing.json"), "utf8")); errors = listingErrors(listing, dir, chain); }
    catch (error) { errors = [`listing.json: ${error.message}`]; }
    // The Explorer merges every folder into one index, so an id is unique across all of them.
    if (seen.has(dir)) errors.push(`id "${dir}" is already used by ${seen.get(dir)}`);
    else seen.set(dir, label);
    errors.push(...imageErrors(path));
    if (checkLinks && listing) {
      const urls = [listing.appUrl, ...(listing.links ?? []).map((l) => l.href)].filter(Boolean);
      for (const result of await Promise.all(urls.map(linkProblem))) {
        if (result?.error) errors.push(result.error);
        if (result?.warn) console.log(`warning ${label}: ${result.warn}`);
      }
    }
    if (errors.length) { failed++; console.log(`✗ ${label}\n${errors.map((e) => `  - ${e}`).join("\n")}`); }
    else console.log(`✓ ${label}`);
  }
  console.log(`\n${dirs.length - failed} of ${dirs.length} listings pass`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) main();
