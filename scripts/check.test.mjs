import test from "node:test";
import assert from "node:assert/strict";
import { listingErrors, imageSize } from "./check.mjs";

const base = { id: "sample", name: "Sample", category: "wallet", network: "mainnet", status: "open", description: "A sample listing used by the validator tests.", appUrl: "https://example.org/", links: [], maintainers: ["kynraze"] };

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

test("field rules: id matches the folder, enums, sentences, sunset", () => {
  assert.match(listingErrors(base, "other", "realio").join(), /must equal its directory name/);
  assert.match(listingErrors({ ...base, category: "games" }, "sample", "realio").join(), /"category" must be one of/);
  assert.match(listingErrors({ ...base, description: "One. Two. Three sentences here." }, "sample", "realio").join(), /more than two sentences/);
  const { appUrl, ...noApp } = base;
  assert.match(listingErrors(noApp, "sample", "realio").join(), /"appUrl" is required/);
  assert.deepEqual(listingErrors({ ...noApp, status: "sunset" }, "sample", "realio"), []);
});

test("imageSize reads a PNG header", () => {
  const png = Buffer.alloc(24);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(192, 16);
  png.writeUInt32BE(96, 20);
  assert.deepEqual(imageSize(png), [192, 96]);
});
