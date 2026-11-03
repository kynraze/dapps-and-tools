// Decodes the logo PNG for the registry checks. Node's zlib only: 8-bit RGB or
// RGBA, non-interlaced. Any other PNG type is rejected by the caller.
import { inflateSync } from "node:zlib";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CHANNELS = { 2: 3, 6: 4 };
// Share of the outer ring that must be opaque; below it the logo has a transparent edge.
const RING_OPAQUE_SHARE = 0.9;
const OPAQUE_ALPHA = 200;

export function decodePng(buffer) {
  if (!SIGNATURE.every((byte, i) => buffer[i] === byte)) throw new Error("not a PNG");
  let pos = 8, width = 0, height = 0, depth = 0, colour = 0, interlace = 0;
  const idat = [];
  while (pos + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colour = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + length;
  }
  const channels = CHANNELS[colour];
  if (depth !== 8 || !channels || interlace !== 0) throw new Error("logo must be an 8-bit RGB or RGBA PNG");

  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride, prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[row + x - channels] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = y > 0 && x >= channels ? out[prev + x - channels] : 0;
      let predictor;
      if (filter === 0) predictor = 0;
      else if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) predictor = paeth(a, b, c);
      else throw new Error(`unknown PNG filter ${filter}`);
      out[row + x] = (raw[src + x] + predictor) & 0xff;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = out[i * channels];
    rgba[i * 4 + 1] = out[i * channels + 1];
    rgba[i * 4 + 2] = out[i * channels + 2];
    rgba[i * 4 + 3] = channels === 4 ? out[i * channels + 3] : 255;
  }
  return { width, height, rgba };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Average colour of the opaque outer ring as "#rrggbb", or null when the edge is transparent. */
export function edgeColour({ width, height, rgba }) {
  let total = 0, opaque = 0, r = 0, g = 0, b = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (x > 0 && y > 0 && x < width - 1 && y < height - 1) continue;
      total++;
      const i = (y * width + x) * 4;
      if (rgba[i + 3] <= OPAQUE_ALPHA) continue;
      opaque++;
      r += rgba[i];
      g += rgba[i + 1];
      b += rgba[i + 2];
    }
  if (total === 0 || opaque / total < RING_OPAQUE_SHARE) return null;
  const hex = (sum) => Math.round(sum / opaque).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
