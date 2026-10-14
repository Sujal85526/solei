// Generates the print masks (white ink on transparent) that scene.py maps onto the bottles.
// Usage: node scripts/blender/labels.mjs [outDir]   (default /tmp/solei-blender/labels)
//
// - perfume-<slug>.png : front decal for the 50 ml glass bottle (42 x 40 mm at 50 px/mm)
// - spray-<slug>.png   : full wrap for the 100 ml spray body   (125.66 x 92 mm at 32 px/mm)
//
// The wordmark is the vector logo (public/images/brand/logo.svg). Small caps text uses macOS
// Baskerville (falls back to any serif through fontconfig on other systems).
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
// sharp ships with Next.js (not a direct dependency) — resolve it from next's install.
const fromRoot = createRequire(join(root, "package.json"));
const sharp = createRequire(fromRoot.resolve("next/package.json"))("sharp");

const outDir = resolve(process.argv[2] ?? "/tmp/solei-blender/labels");
mkdirSync(outDir, { recursive: true });

const logoSvg = readFileSync(join(root, "public/images/brand/logo.svg"), "utf8");
const LOGO_W = 1942.746208;
const LOGO_H = 805.792786;
const logoInner = logoSvg
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .replace(/fill="#[0-9a-fA-F]+"/g, 'fill="#fff"');

/** Logo placed with its bbox centre at (cx, cy), `w` wide, optionally rotated (deg). */
function logo(cx, cy, w, rotate = 0) {
  const h = (w * LOGO_H) / LOGO_W;
  return `<g transform="translate(${cx} ${cy}) rotate(${rotate})">
    <svg x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" viewBox="0 0 ${LOGO_W} ${LOGO_H}">${logoInner}</svg>
  </g>`;
}

const SERIF = "Baskerville, 'Libre Baskerville', 'Times New Roman', serif";
function text(cx, baseline, size, str, spacing) {
  // letter-spacing adds trailing space after the last glyph; shift by half to stay centred.
  return `<text x="${cx + spacing / 2}" y="${baseline}" font-family="${SERIF}" font-size="${size}" font-weight="600"
    letter-spacing="${spacing}" text-anchor="middle" fill="#fff">${str}</text>`;
}

async function write(name, w, h, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(join(outDir, name));
}

const perfumes = ["cannes", "marbella", "verona", "capri", "santorini"];
const sprays = ["soho", "monaco", "mayfair"];

// Perfume decal: 42 x 40 mm, 50 px/mm. Wordmark 22 mm wide; destination 3.6 mm caps.
{
  const pxmm = 50;
  const W = 42 * pxmm;
  const H = 40 * pxmm;
  for (const slug of perfumes) {
    // Destination caps sized so the line never runs wider than ~21 mm (≈ the wordmark),
    // keeping long names (SANTORINI) clear of the bottle's edge highlights.
    const name = slug.toUpperCase();
    const capMm = Math.min(5.0, 21 / (name.length * 0.8));
    const body =
      logo(W / 2, H * 0.36, 22 * pxmm) +
      text(W / 2, H * 0.36 + (6.2 + capMm * 0.68) * pxmm, capMm * pxmm, name, capMm * 0.09 * pxmm);
    await write(`perfume-${slug}.png`, W, H, body);
  }
}

// Spray wrap: circumference of a 40 mm tube x 92 mm body, 32 px/mm. u = 0.5 faces the camera.
{
  const pxmm = 32;
  const W = Math.round(Math.PI * 40 * pxmm);
  const H = 92 * pxmm;
  const cx = W / 2;
  const mm = (v) => H - v * pxmm; // millimetres above the base -> y px
  for (const slug of sprays) {
    const body =
      // reads bottom-to-top: letter tops face the left of the tube (rotated 90° CCW)
      logo(cx, mm(50), 38 * pxmm, -90) +
      text(cx, mm(20), 2.6 * pxmm, slug.toUpperCase(), 0.32 * pxmm) +
      text(cx, mm(15), 2.2 * pxmm, "ALL OVER SPRAY", 0.26 * pxmm) +
      text(cx, mm(10), 2.2 * pxmm, "100ML", 0.26 * pxmm);
    await write(`spray-${slug}.png`, W, H, body);
  }
}

console.log(`labels written to ${outDir}`);
