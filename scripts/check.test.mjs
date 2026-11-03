import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { listingErrors, imageSize } from "./check.mjs";
import { decodePng, edgeColour } from "./png.mjs";
import { nextRecord } from "./probe.mjs";

// A PNG encoder for tests only: every row uses one filter type, so each decoder branch runs.
function makePng(width, height, colour, pixel, filter = 0) {
  const channels = colour === 6 ? 4 : colour === 2 ? 3 : 1;
  const stride = width * channels;
  const bytes = (y) => Array.from({ length: width }, (_, x) => pixel(x, y).slice(0, channels)).flat();
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  const rows = [];
  for (let y = 0; y < height; y++) {
    const cur = bytes(y), prev = y ? bytes(y - 1) : new Array(stride).fill(0);
    rows.push(filter);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0, b = prev[x], c = x >= channels ? prev[x - channels] : 0;
      rows.push((cur[x] - [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter]) & 0xff);
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = colour;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// The smallest listing: what an author has to write.
const base = { name: "Sample", category: "wallet", description: "A sample listing used by the validator tests.", appUrl: "https://example.org/" };

test("a chain-folder listing passes and must not repeat its chain", () => {
  assert.deepEqual(listingErrors(base, "sample", "realio"), []);
  assert.match(listingErrors({ ...base, chains: ["realio"] }, "sample", "realio").join(), /belongs only in shared/);
  assert.match(listingErrors(base, "sample", "not-a-chain").join(), /not a chain in chains.json/);
});

test("a shared listing needs two or more known chains", () => {
  assert.deepEqual(listingErrors({ ...base, chains: ["realio", "atomone"] }, "sample"), []);
  assert.match(listingErrors({ ...base, chains: ["realio"] }, "sample").join(), /two or more chains/);
  assert.match(listingErrors({ ...base, chains: ["realio", "nope"] }, "sample").join(), /unknown chain "nope"/);
});

test("field rules: folder name, enums, sentences, required fields", () => {
  assert.match(listingErrors(base, "Not_A_Slug", "realio").join(), /folder name/);
  assert.match(listingErrors({ ...base, category: "games" }, "sample", "realio").join(), /"category" must be one of/);
  assert.match(listingErrors({ ...base, network: "mainnet" }, "sample", "realio").join(), /"network" must be one of testnet/);
  assert.deepEqual(listingErrors({ ...base, network: "testnet" }, "sample", "realio"), []);
  assert.match(listingErrors({ ...base, description: "One. Two. Three sentences here." }, "sample", "realio").join(), /more than two sentences/);
  const { appUrl, ...noApp } = base;
  assert.match(listingErrors(noApp, "sample", "realio").join(), /missing "appUrl"/);
  assert.match(listingErrors({ ...base, status: "open" }, "sample", "realio").join(), /unknown field "status"/);
});

test("the daily probe keeps the first failure and clears it when the app answers", () => {
  const ok = nextRecord(undefined, true, "2026-11-01T05:00:00Z");
  assert.deepEqual(ok, { lastOk: "2026-11-01T05:00:00Z", failingSince: null });
  const down = nextRecord(ok, false, "2026-11-02T05:00:00Z");
  assert.deepEqual(nextRecord(down, false, "2026-11-03T05:00:00Z"), { lastOk: "2026-11-01T05:00:00Z", failingSince: "2026-11-02T05:00:00Z" });
  assert.deepEqual(nextRecord(down, true, "2026-11-04T05:00:00Z"), { lastOk: "2026-11-04T05:00:00Z", failingSince: null });
});

test("an opaque PNG gives its edge colour, whatever the row filter", () => {
  for (let filter = 0; filter <= 4; filter++)
    assert.equal(edgeColour(decodePng(makePng(5, 4, 6, () => [200, 100, 50, 255], filter))), "#c86432");
  const solid = decodePng(makePng(4, 4, 6, () => [200, 100, 50, 255]));
  assert.equal(edgeColour(solid), "#c86432");
  assert.equal(edgeColour(decodePng(makePng(4, 4, 2, () => [200, 100, 50]))), "#c86432");
});

test("a logo with a transparent ring has no edge colour", () => {
  const ring = decodePng(makePng(4, 4, 6, (x, y) => (x === 0 || y === 0 || x === 3 || y === 3 ? [255, 255, 255, 0] : [10, 20, 30, 255])));
  assert.equal(edgeColour(ring), null);
});

test("only 8-bit RGB or RGBA PNGs decode", () => {
  assert.throws(() => decodePng(makePng(2, 2, 3, () => [0, 0, 0, 255])), /8-bit RGB or RGBA PNG/);
  assert.throws(() => decodePng(Buffer.from("not a png")), /not a PNG/);
});

test("every tool category passes; an unknown category fails", () => {
  for (const category of ["wallet", "explorer", "analytics", "monitoring", "developer-tools", "infrastructure"])
    assert.deepEqual(listingErrors({ ...base, category }, "sample", "realio"), []);
  assert.match(listingErrors({ ...base, category: "games" }, "sample", "realio").join(), /"category" must be one of/);
});

test("imageSize reads a PNG header", () => {
  const png = Buffer.alloc(24);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(192, 16);
  png.writeUInt32BE(96, 20);
  assert.deepEqual(imageSize(png), [192, 96]);
});
