# Product renders (Blender)

The per-product images in `public/images/renders/` (`product-<slug>-<perfume|spray>.jpg/.webp`) are 3D
product visualisations generated entirely from these scripts — no `.blend` files are committed. They are
placeholders until the client uploads real product photos via admin (see `docs/DECISIONS.md`, T9).
`render_all.py` also defines hero, collection and detail shots; those are not shipped (the client supplied
hero/lifestyle imagery), but they still render if you ask for them by name.

| File            | Role                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `labels.mjs`    | Rasterises the print masks (vector `public/images/brand/logo.svg` + Baskerville caps) for each bottle with sharp.                               |
| `scene.py`      | Procedural scene: perfume bottle (thick-base glass, juice volume, dip tube, collar, lacquer ball cap), spray tube, travertine, arch, palm gobo. |
| `render_all.py` | Shot list (hero, collections, 8 product squares, 2 details) and Cycles settings; writes 16-bit PNGs.                                            |
| `optimise.mjs`  | PNG → progressive mozjpeg JPEG (q84) + WebP (q82) into `public/images/renders/`.                                                                |

## Reproduce

Requires Blender 5.2 (tested with 5.2.2 LTS on an Apple M3, Metal GPU), Node 20+ and `pnpm install`
(sharp is resolved from Next.js's install). Run from the repo root:

```sh
node scripts/blender/labels.mjs /tmp/solei-blender/labels
SOLEI_LABEL_DIR=/tmp/solei-blender/labels \
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  -P scripts/blender/render_all.py -- --out /tmp/solei-blender/out \
  --shots $(echo product-{cannes,marbella,verona,capri,santorini}-perfume product-{soho,monaco,mayfair}-spray | tr ' ' ,)
# ship only the product squares
mkdir -p /tmp/solei-blender/ship && cp /tmp/solei-blender/out/product-*-{perfume,spray}.png /tmp/solei-blender/ship/
node scripts/blender/optimise.mjs /tmp/solei-blender/ship public/images/renders
```

Useful flags for `render_all.py` (after `--`):

- `--shots hero-collection,product-cannes-perfume` — render a subset (names = output file names)
- `--scale 0.35 --samples 128` — quick low-res previews while iterating
- `--cpu` — force CPU if no Metal/GPU device is available (much slower)

## Notes

- Units are metres at real product scale (perfume ≈ 112 mm tall, spray 138 × Ø40 mm), so depth of field
  is physical: f/9–11 at macro distance gives the same soft background as f/4–5.6 on a larger set.
- Lighting: a warm late-sun pair with light linking — one sun lights the set through a palm-frond gobo,
  an identical sun lights only the products (so leaf shadows never cross a label). Strip boxes, a small
  kicker and black flags are visible only in reflections/refraction and only on the products, which is
  what gives the glass its edges and the lacquer cap its highlights.
- Glass uses the shadow-ray trick (transparent to shadow rays) instead of caustics; juice colour is a
  volume absorption, so thicker liquid reads deeper, like the real bottles.
- Settings: Cycles, 384 max samples, adaptive threshold 0.012, OpenImageDenoise (albedo + normal),
  AgX "Medium High Contrast", 24 bounces (18 transmission). Renders take ~1–4 min per image on an M3.
- Label text uses macOS Baskerville; on other systems fontconfig substitutes another serif, so labels
  can differ slightly from the committed images.
