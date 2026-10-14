// Converts the 16-bit PNGs from render_all.py into web assets.
// Usage: node scripts/blender/optimise.mjs [inDir] [outDir]
//   inDir  default /tmp/solei-blender/out
//   outDir default public/images/renders
// Writes <name>.jpg (progressive mozjpeg, q84) and <name>.webp (q82) for every PNG in inDir.
import { createRequire } from "node:module";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const sharp = createRequire(createRequire(join(root, "package.json")).resolve("next/package.json"))(
  "sharp",
);

const inDir = resolve(process.argv[2] ?? "/tmp/solei-blender/out");
const outDir = resolve(process.argv[3] ?? join(root, "public/images/renders"));
mkdirSync(outDir, { recursive: true });

const kb = (f) => `${Math.round(statSync(f).size / 1024)} KB`;

for (const file of readdirSync(inDir)
  .filter((f) => f.endsWith(".png"))
  .sort()) {
  const name = basename(file, ".png");
  const src = sharp(join(inDir, file)).toColourspace("srgb");
  const { width, height } = await src.metadata();
  const jpg = join(outDir, `${name}.jpg`);
  const webp = join(outDir, `${name}.webp`);
  await src
    .clone()
    .jpeg({ quality: 84, progressive: true, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(jpg);
  await src.clone().webp({ quality: 82, effort: 6, smartSubsample: true }).toFile(webp);
  console.log(`${name.padEnd(28)} ${width}x${height}  jpg ${kb(jpg)}  webp ${kb(webp)}`);
}
