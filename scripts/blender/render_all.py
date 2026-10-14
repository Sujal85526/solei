"""Render the Solei product imagery.

    Blender -b --factory-startup -P scripts/blender/render_all.py -- \
        --out /tmp/solei-blender/out [--shots hero-collection,product-cannes-perfume] [--scale 1.0] [--samples 384]

Writes 16-bit PNGs named <shot>.png into --out; scripts/blender/optimise.mjs turns them into the
JPEG/WebP files in public/images/renders/.
"""

from __future__ import annotations

import argparse
import math
import os
import sys
import time

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scene as S  # noqa: E402

# --------------------------------------------------------------------------------------------
# Shots
# --------------------------------------------------------------------------------------------


PLINTH_H = 0.020


def _product_set(height, seed=7):
    """Shared product-shot set: cream room, travertine disc, late sun through a palm gobo."""
    S.setup_world(0.06, color="#F6E9DD")
    S.build_room(wall_y=0.30)
    S.build_plinth((0, 0, 0), radius=0.062, height=PLINTH_H)
    S.studio_lighting(
        focus=(0, 0, PLINTH_H + height * 0.5),
        sun_dir=(-0.72, -0.48, 0.50),
        sun_strength=5.5,
        gobo_target=(0.02, 0.30, 0.20),
        gobo_dist=0.5,
        gobo_scale=0.75,
        fill=0.35,
        product_sun_dir=(-0.85, 0.22, 0.48),
        seed=seed,
    )
    S.build_petal((0.07, -0.05, 0.0004), (0.02, 0.0, math.radians(30)), size=0.022, seed=3)
    S.build_petal((0.088, -0.022, 0.0004), (0.0, -0.05, math.radians(-80)), size=0.018, color="#E3A3A6", key="blush", seed=5)


def _product_camera(height, lens=85, fill=0.64):
    """Same framing rule for every product: object + plinth fill `fill` of the frame height."""
    total = PLINTH_H + height
    frame = total / fill
    dist = frame * lens / 36.0
    tz = total * 0.5 + 0.004
    elev = math.radians(7)
    S.add_camera(
        (0.0, -dist * math.cos(elev), tz + dist * math.sin(elev)),
        (0, 0, tz),
        lens=lens,
        fstop=11,
        focus=(0, -0.02, tz),
    )


def shot_product_perfume(slug):
    def build():
        _product_set(S.P_HEIGHT)
        S.build_perfume(slug, (0, 0, PLINTH_H))
        _product_camera(S.P_HEIGHT)
        return (1600, 1600)

    return build


def shot_product_spray(slug):
    def build():
        _product_set(S.S_HEIGHT)
        S.build_spray(slug, (0, 0, PLINTH_H))
        _product_camera(S.S_HEIGHT)
        return (1600, 1600)

    return build


# --- editorial sets ---------------------------------------------------------------------------

WALL_Y = 0.26


def _editorial_set(focus, gobo_target, arch_x, arch_w=0.26, arch_h=0.44, sun_strength=5.5, fill=0.45, seed=11,
                   gobo_roll=0.0, gobo_scale=0.9):
    S.setup_world(0.06, color="#F6E9DD")
    S.build_room(wall_y=WALL_Y)
    S.build_arch(arch_x, WALL_Y, 0.0, arch_w, arch_h)
    S.build_sun_disc(arch_x + arch_w * 0.22, WALL_Y, arch_h - arch_w * 0.5 + 0.02, r=0.016, line=0.004)
    S.studio_lighting(
        focus=focus,
        sun_dir=(-0.72, -0.48, 0.50),
        product_sun_dir=(-0.85, 0.22, 0.48),
        sun_strength=sun_strength,
        gobo_target=gobo_target,
        gobo_dist=0.55,
        gobo_scale=gobo_scale,
        gobo_roll=gobo_roll,
        fill=fill,
        strip_span=0.45,
        flag_span=0.6,
        seed=seed,
    )


def _petals(specs):
    for i, (x, y, z, rz, col) in enumerate(specs):
        key, hexc = ("burgundy", "#420818") if col == "b" else ("blush", "#E3A3A6")
        S.build_petal((x, y, z + 0.0002), (0.0, 0.0, math.radians(rz)), color=hexc, key=key, seed=20 + i)


HERO_GOBO = [(0.16, WALL_Y, 0.38), 135.0, 0.75]


def _hero_scene():
    # stepped travertine: tall block back-right, long low step in front
    S.build_block("step-high", (0.20, 0.13, 0.125), (0.085, 0.085, 0.0))
    S.build_block("step-low", (0.34, 0.15, 0.048), (0.015, -0.035, 0.0))
    S.build_spray("soho", (0.055, 0.085, 0.125), rot_z_deg=4)
    S.build_spray("monaco", (0.115, 0.075, 0.125), rot_z_deg=-6)
    S.build_spray("mayfair", (0.03, -0.075, 0.048), lying=-20, rot_z_deg=-4)
    S.build_perfume("cannes", (-0.085, -0.045, 0.048), rot_z_deg=8)
    S.build_perfume("verona", (-0.025, -0.07, 0.048), rot_z_deg=-4)
    _petals([
        (0.0, -0.1, 0.048, 25, "b"),
        (0.19, -0.13, 0.0, -70, "w"),
        (0.17, -0.145, 0.0, 140, "b"),
        (-0.14, -0.13, 0.0, 60, "w"),
    ])
    _editorial_set(focus=(0.02, 0.0, 0.10), gobo_target=HERO_GOBO[0], arch_x=0.085, arch_w=0.24, arch_h=0.36,
                   gobo_roll=HERO_GOBO[1], gobo_scale=HERO_GOBO[2])


def shot_hero():
    _hero_scene()
    target = (-0.11, 0.0, 0.135)
    S.add_camera((-0.08, -1.30, 0.25), target, lens=70, fstop=9, focus=(0.0, -0.07, 0.09))
    return (2400, 1600)


def shot_hero_portrait():
    _hero_scene()
    target = (0.045, 0.0, 0.118)
    S.add_camera((0.05, -1.12, 0.22), target, lens=70, fstop=9, focus=(0.0, -0.07, 0.09))
    return (1200, 1600)


def shot_collection_perfumes():
    S.build_plinth((0.0, 0.05, 0.0), radius=0.046, height=0.07)
    S.build_block("step-low", (0.27, 0.13, 0.026), (0.0, -0.035, 0.0), rot_z=0)
    S.build_perfume("marbella", (0.0, 0.05, 0.07), rot_z_deg=0)
    S.build_perfume("cannes", (-0.068, -0.045, 0.026), rot_z_deg=10)
    S.build_perfume("verona", (0.068, -0.045, 0.026), rot_z_deg=-10)
    _petals([
        (0.02, -0.085, 0.026, 30, "b"),
        (0.035, -0.115, 0.0, -60, "w"),
        (-0.115, -0.12, 0.0, 110, "b"),
    ])
    _editorial_set(focus=(0.0, 0.0, 0.09), gobo_target=(-0.10, WALL_Y, 0.27), arch_x=0.0, arch_w=0.24, arch_h=0.40)
    S.add_camera((0.0, -0.80, 0.19), (0.0, 0.0, 0.118), lens=70, fstop=11, focus=(0.0, -0.04, 0.1))
    return (1600, 2000)


def shot_collection_sprays():
    S.build_block("step-high", (0.12, 0.11, 0.075), (0.03, 0.06, 0.0))
    S.build_block("step-low", (0.17, 0.12, 0.03), (-0.035, -0.035, 0.0))
    S.build_spray("soho", (0.03, 0.06, 0.075), rot_z_deg=3)
    S.build_spray("monaco", (-0.045, -0.03, 0.03), rot_z_deg=-5)
    S.build_spray("mayfair", (-0.005, -0.095, 0.0), lying=-18, rot_z_deg=-4)
    _petals([
        (-0.09, -0.11, 0.0, 40, "b"),
        (-0.07, -0.135, 0.0, -50, "w"),
        (0.105, -0.06, 0.0, 120, "b"),
    ])
    _editorial_set(focus=(0.0, 0.0, 0.10), gobo_target=(-0.10, WALL_Y, 0.30), arch_x=0.0, arch_w=0.24, arch_h=0.42)
    S.add_camera((0.0, -0.86, 0.20), (0.0, 0.0, 0.122), lens=70, fstop=11, focus=(0.0, -0.05, 0.1))
    return (1600, 2000)


def shot_perfume_detail():
    _product_set(S.P_HEIGHT)
    S.build_perfume("cannes", (0, 0, PLINTH_H), rot_z_deg=0)
    z = PLINTH_H + S.P_COLLAR_Z1
    S.add_camera((0.05, -0.30, z + 0.06), (0.0, 0.0, z - 0.004), lens=100, fstop=6.3, focus=(0.0, -0.012, z + 0.004))
    return (1600, 1600)


def shot_spray_detail():
    _product_set(S.S_HEIGHT)
    S.build_spray("soho", (0, 0, PLINTH_H), rot_z_deg=0)
    z = PLINTH_H + S.S_BODY_TOP
    S.add_camera((-0.06, -0.32, z + 0.09), (0.0, 0.0, z + 0.004), lens=100, fstop=6.3, focus=(0.0, -0.018, z + 0.002))
    return (1600, 1600)


SHOTS = {
    "hero-collection": shot_hero,
    "hero-collection-portrait": shot_hero_portrait,
    "collection-perfumes": shot_collection_perfumes,
    "collection-sprays": shot_collection_sprays,
}

for _slug in S.PERFUMES:
    SHOTS[f"product-{_slug}-perfume"] = shot_product_perfume(_slug)
for _slug in S.SPRAYS:
    SHOTS[f"product-{_slug}-spray"] = shot_product_spray(_slug)
SHOTS["product-perfume-detail"] = shot_perfume_detail
SHOTS["product-spray-detail"] = shot_spray_detail


# --------------------------------------------------------------------------------------------


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/solei-blender/out")
    ap.add_argument("--shots", default="all")
    ap.add_argument("--scale", type=float, default=1.0, help="resolution multiplier for previews")
    ap.add_argument("--samples", type=int, default=384)
    ap.add_argument("--cpu", action="store_true")
    args = ap.parse_args(argv)
    os.makedirs(args.out, exist_ok=True)
    names = list(SHOTS) if args.shots == "all" else [s.strip() for s in args.shots.split(",") if s.strip()]
    timings = []
    for name in names:
        if name not in SHOTS:
            raise SystemExit(f"unknown shot {name}; known: {', '.join(SHOTS)}")
        S.reset_scene()
        S._MATS.clear()
        w, h = SHOTS[name]()
        S.finalize_light_linking()
        device = S.configure_render(int(w * args.scale), int(h * args.scale), samples=args.samples, use_gpu=not args.cpu)
        bpy.context.scene.render.filepath = os.path.join(args.out, f"{name}.png")
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        dt = time.time() - t0
        timings.append((name, dt))
        print(f"[solei] {name}: {int(w * args.scale)}x{int(h * args.scale)} on {device} in {dt:.1f}s", flush=True)
    for name, dt in timings:
        print(f"[solei] {name:32s} {dt:7.1f}s")


if __name__ == "__main__":
    main()
