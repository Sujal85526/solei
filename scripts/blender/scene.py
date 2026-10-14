"""Procedural Solei product scene for Blender 5.2 (Cycles).

Everything — bottles, materials, stone props, the palm-frond gobo and lights — is built from code so
renders are reproducible without committing .blend files. Units are metres at real product scale
(50 ml perfume ~ 112 mm tall, 100 ml spray 138 mm tall).

Imported by render_all.py; see README.md in this folder.
"""

from __future__ import annotations

import math
import os
import random

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

# --------------------------------------------------------------------------------------------
# Colour helpers
# --------------------------------------------------------------------------------------------


def srgb(hex_str: str, alpha: float = 1.0):
    """'#RRGGBB' -> linear RGBA tuple (Blender colour sockets are scene-linear)."""
    h = hex_str.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, alpha)


# --------------------------------------------------------------------------------------------
# Product data
# --------------------------------------------------------------------------------------------

# Transmittance of the juice through ~4 cm (R, G, B) -> converted to volume absorption.
PERFUMES = {
    "cannes": {"name": "Cannes", "juice": (0.50, 0.12, 0.018), "ink": "#EBC3CF"},
    "marbella": {"name": "Marbella", "juice": (0.70, 0.29, 0.04), "ink": "#EEC8D2"},
    "verona": {"name": "Verona", "juice": (0.975, 0.90, 0.875), "ink": "#7A1846"},
    "capri": {"name": "Capri", "juice": (0.965, 0.925, 0.66), "ink": "#7A1846"},
    "santorini": {"name": "Santorini", "juice": (0.985, 0.965, 0.905), "ink": "#7A1846"},
}
SPRAYS = {
    "soho": {"name": "Soho"},
    "monaco": {"name": "Monaco"},
    "mayfair": {"name": "Mayfair"},
}

# Perfume bottle dimensions (m)
P_R = 0.0235  # body outer radius
P_BODY_TOP = 0.0665  # top of the shoulder
P_NECK_R = 0.0092
P_NECK_TOP = 0.0740
P_COLLAR_R = 0.0135
P_COLLAR_Z0 = 0.0688
P_COLLAR_Z1 = 0.0768
P_BALL_R = 0.0168
P_HEIGHT = P_COLLAR_Z1 + 0.0015 + 2 * P_BALL_R

# Spray dimensions (m)
S_R = 0.0200
S_BODY_TOP = 0.092
S_BAND_TOP = 0.0975
S_HEIGHT = 0.138

LABEL_DIR = os.environ.get("SOLEI_LABEL_DIR", "/tmp/solei-blender/labels")

# --------------------------------------------------------------------------------------------
# Scene reset
# --------------------------------------------------------------------------------------------


def reset_scene():
    for coll in (
        bpy.data.objects,
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.lights,
        bpy.data.cameras,
        bpy.data.images,
        bpy.data.node_groups,
        bpy.data.worlds,
    ):
        if len(coll):
            bpy.data.batch_remove(list(coll))
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)


# --------------------------------------------------------------------------------------------
# Geometry helpers
# --------------------------------------------------------------------------------------------


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def arc(cx, cz, r, a0, a1, n):
    """Points on an arc in the (r, z) profile plane, angles in degrees."""
    pts = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def dedupe(profile, eps=1e-7):
    out = []
    for p in profile:
        if not out or (abs(out[-1][0] - p[0]) > eps or abs(out[-1][1] - p[1]) > eps):
            out.append(p)
    return out


def lathe(name, profile, segments=192, uv_mode=None, v_range=(0.0, 1.0), smooth=True):
    """Revolve an (r, z) profile around Z. Points with r == 0 become poles.

    uv_mode='wrap': u = angle (front, facing -Y, at u = 0.5), v = (z - v0) / (v1 - v0).
    """
    profile = dedupe(profile)
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r < 1e-9:
            rings.append([bm.verts.new((0.0, 0.0, z))])
        else:
            ring = []
            for i in range(segments):
                # theta = 0 points to -Y (camera side); increases towards +X
                t = 2 * math.pi * i / segments
                ring.append(bm.verts.new((r * math.sin(t), -r * math.cos(t), z)))
            rings.append(ring)
    faces = []
    for a, b in zip(rings[:-1], rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(segments):
            j = (i + 1) % segments
            if len(a) == 1:
                f = bm.faces.new((a[0], b[i], b[j]))
            elif len(b) == 1:
                f = bm.faces.new((a[i], b[0], a[j]))
            else:
                f = bm.faces.new((a[i], b[i], b[j], a[j]))
            faces.append((f, i))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if uv_mode == "wrap":
        uv = bm.loops.layers.uv.new("UVMap")
        v0, v1 = v_range
        for f, i in faces:
            for loop in f.loops:
                co = loop.vert.co
                t = math.atan2(co.x, -co.y)  # 0 at front
                u = 0.5 + t / (2 * math.pi)
                # fix the seam at the back
                if i == segments - 1 or i >= segments // 2:
                    pass
                loop[uv].uv = (u, (co.z - v0) / (v1 - v0))
        # repair seam: faces straddling u=0/1 get continuous u
        for f, _ in faces:
            us = [loop[uv].uv.x for loop in f.loops]
            if max(us) - min(us) > 0.5:
                for loop in f.loops:
                    if loop[uv].uv.x < 0.5:
                        loop[uv].uv.x += 1.0
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
    obj = bpy.data.objects.new(name, me)
    return link(obj)


def rounded_box(name, size, bevel=0.004, segments=4):
    sx, sy, sz = size
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
        v.co.z += sz / 2
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = bevel
    mod.segments = segments
    mod.limit_method = "NONE"
    # subdivide a little so the displacement-free bump reads on large faces
    me.shade_smooth()
    mod.harden_normals = False
    obj.modifiers.new("wn", "WEIGHTED_NORMAL")
    return obj


def set_visibility(obj, camera=True, diffuse=True, glossy=True, transmission=True, shadow=True):
    obj.visible_camera = camera
    obj.visible_diffuse = diffuse
    obj.visible_glossy = glossy
    obj.visible_transmission = transmission
    obj.visible_shadow = shadow


# --------------------------------------------------------------------------------------------
# Node helpers
# --------------------------------------------------------------------------------------------


def new_material(name):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:  # removed in later versions where nodes are always on
        pass
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return mat, nt, out


def principled(nt, **kw):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    for k, v in kw.items():
        p.inputs[k.replace("_", " ")].default_value = v
    return p


def socket(node, name, out=False, kind=None):
    socks = node.outputs if out else node.inputs
    for s in socks:
        if s.name == name and s.enabled and (kind is None or s.type == kind):
            return s
    raise KeyError(f"{node.name}: {name}")


def mix_rgb(nt, fac, a, b, blend="MIX"):
    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "RGBA"
    m.blend_type = blend
    _set_or_link(nt, socket(m, "Factor", kind="VALUE"), fac)
    _set_or_link(nt, socket(m, "A", kind="RGBA"), a)
    _set_or_link(nt, socket(m, "B", kind="RGBA"), b)
    return socket(m, "Result", out=True, kind="RGBA")


def _set_or_link(nt, sock, val):
    if isinstance(val, bpy.types.NodeSocket):
        nt.links.new(val, sock)
    else:
        sock.default_value = val


def ramp(nt, src, stops):
    """stops: list of (pos, rgba)."""
    r = nt.nodes.new("ShaderNodeValToRGB")
    els = r.color_ramp.elements
    while len(els) > 1:
        els.remove(els[-1])
    els[0].position, els[0].color = stops[0]
    for pos, col in stops[1:]:
        e = els.new(pos)
        e.color = col
    nt.links.new(src, r.inputs["Fac"])
    return r.outputs["Color"]


def shadow_transparent(nt, surface_out, tint=(1, 1, 1, 1)):
    """Light-path trick: glass lets shadow rays straight through (no caustics needed)."""
    lp = nt.nodes.new("ShaderNodeLightPath")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = tint
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Shadow Ray"], mix.inputs[0])
    nt.links.new(surface_out, mix.inputs[1])
    nt.links.new(tr.outputs[0], mix.inputs[2])
    return mix.outputs[0]


# --------------------------------------------------------------------------------------------
# Materials
# --------------------------------------------------------------------------------------------

_MATS: dict[str, bpy.types.Material] = {}


def mat_glass():
    if "glass" in _MATS:
        return _MATS["glass"]
    mat, nt, out = new_material("Glass")
    p = principled(
        nt,
        Base_Color=(0.985, 0.99, 0.985, 1),
        Roughness=0.0,
        IOR=1.5,
        Transmission_Weight=1.0,
    )
    s = shadow_transparent(nt, p.outputs[0], tint=(0.93, 0.93, 0.92, 1))
    nt.links.new(s, out.inputs["Surface"])
    _MATS["glass"] = mat
    return mat


def mat_acrylic():
    if "acrylic" in _MATS:
        return _MATS["acrylic"]
    mat, nt, out = new_material("Acrylic")
    p = principled(nt, Base_Color=(0.97, 0.975, 0.975, 1), Roughness=0.02, IOR=1.49, Transmission_Weight=1.0)
    s = shadow_transparent(nt, p.outputs[0], tint=(0.85, 0.85, 0.85, 1))
    nt.links.new(s, out.inputs["Surface"])
    _MATS["acrylic"] = mat
    return mat


def mat_juice(slug):
    key = "juice-" + slug
    if key in _MATS:
        return _MATS[key]
    mat, nt, out = new_material("Juice " + slug)
    # Liquid overlaps the glass wall slightly; a relative IOR keeps refraction plausible.
    p = principled(nt, Base_Color=(1, 1, 1, 1), Roughness=0.0, IOR=1.22, Transmission_Weight=1.0)
    s = shadow_transparent(nt, p.outputs[0])
    nt.links.new(s, out.inputs["Surface"])
    tr = PERFUMES[slug]["juice"]
    k = [-math.log(max(t, 1e-4)) / 0.04 for t in tr]  # absorption per metre
    dens = max(k)
    vol = nt.nodes.new("ShaderNodeVolumeAbsorption")
    vol.inputs["Density"].default_value = dens
    vol.inputs["Color"].default_value = (*(1 - c / dens for c in k), 1)
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    _MATS[key] = mat
    return mat


def mat_ball():
    if "ball" in _MATS:
        return _MATS["ball"]
    mat, nt, out = new_material("Burgundy lacquer")
    p = principled(
        nt,
        Base_Color=srgb("#560917"),
        Roughness=0.38,
        Coat_Weight=1.0,
        Coat_Roughness=0.02,
        Coat_IOR=1.45,
        Specular_IOR_Level=0.35,
    )
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    _MATS["ball"] = mat
    return mat


def mat_metal(name, hex_col, rough=0.2, aniso=0.0):
    key = "metal-" + name
    if key in _MATS:
        return _MATS[key]
    mat, nt, out = new_material(name)
    p = principled(nt, Base_Color=srgb(hex_col), Metallic=1.0, Roughness=rough, Anisotropic=aniso)
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    _MATS[key] = mat
    return mat


def mat_gold_band():
    if "goldband" in _MATS:
        return _MATS["goldband"]
    mat, nt, out = new_material("Gold band")
    # fine horizontal brushing
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 4000.0
    noise.inputs["Detail"].default_value = 2.0
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(sep.outputs["Z"], comb.inputs["Z"])
    nt.links.new(comb.outputs[0], noise.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.05
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    p = principled(nt, Base_Color=srgb("#D9B77E"), Metallic=1.0, Roughness=0.16, Anisotropic=0.6)
    p.inputs["Specular Tint"].default_value = srgb("#F2D9A8")
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    _MATS["goldband"] = mat
    return mat


BLUSH = "#DE9D92"


def _satin_pink(nt):
    # subtle powder-coat texture
    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 900.0
    noise.inputs["Detail"].default_value = 4.0
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.035
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    p = principled(
        nt,
        Base_Color=srgb(BLUSH),
        Roughness=0.46,
        Specular_IOR_Level=0.45,
        Sheen_Weight=0.25,
        Sheen_Roughness=0.4,
    )
    p.inputs["Sheen Tint"].default_value = srgb("#FFE3DA")
    p.inputs["Diffuse Roughness"].default_value = 0.3
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return p, bump


def mat_spray_cap():
    if "spraycap" in _MATS:
        return _MATS["spraycap"]
    mat, nt, out = new_material("Spray cap")
    p, _ = _satin_pink(nt)
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    _MATS["spraycap"] = mat
    return mat


def mat_spray_body(slug):
    key = "spraybody-" + slug
    if key in _MATS:
        return _MATS[key]
    mat, nt, out = new_material("Spray body " + slug)
    pink, bump = _satin_pink(nt)
    img = bpy.data.images.load(os.path.join(LABEL_DIR, f"spray-{slug}.png"), check_existing=True)
    img.colorspace_settings.name = "Non-Color"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Cubic"
    tex.extension = "REPEAT"
    uvn = nt.nodes.new("ShaderNodeUVMap")
    nt.links.new(uvn.outputs[0], tex.inputs["Vector"])
    ink = principled(nt, Base_Color=srgb("#4E0A20"), Roughness=0.24, Specular_IOR_Level=0.6)
    nt.links.new(bump.outputs["Normal"], ink.inputs["Normal"])
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(tex.outputs["Alpha"], mix.inputs[0])
    nt.links.new(pink.outputs[0], mix.inputs[1])
    nt.links.new(ink.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    _MATS[key] = mat
    return mat


def mat_perfume_ink(slug):
    key = "pink-" + slug
    if key in _MATS:
        return _MATS[key]
    mat, nt, out = new_material("Print " + slug)
    img = bpy.data.images.load(os.path.join(LABEL_DIR, f"perfume-{slug}.png"), check_existing=True)
    img.colorspace_settings.name = "Non-Color"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Cubic"
    tex.extension = "CLIP"
    ink = principled(nt, Base_Color=srgb(PERFUMES[slug]["ink"]), Roughness=0.35, Specular_IOR_Level=0.5)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(tex.outputs["Alpha"], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(ink.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    _MATS[key] = mat
    return mat


def mat_plaster():
    if "plaster" in _MATS:
        return _MATS["plaster"]
    mat, nt, out = new_material("Cream plaster")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise")
    n1.inputs["Scale"].default_value = 6.0
    n1.inputs["Detail"].default_value = 3.0
    nt.links.new(tc.outputs["Object"], n1.inputs["Vector"])
    col = ramp(nt, n1.outputs["Fac"], [(0.35, srgb("#EDE0D5")), (0.65, srgb("#F4EAE2"))])
    n2 = nt.nodes.new("ShaderNodeTexNoise")
    n2.inputs["Scale"].default_value = 180.0
    n2.inputs["Detail"].default_value = 6.0
    nt.links.new(tc.outputs["Object"], n2.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.06
    nt.links.new(n2.outputs["Fac"], bump.inputs["Height"])
    p = principled(nt, Roughness=0.85, Specular_IOR_Level=0.3)
    p.inputs["Diffuse Roughness"].default_value = 0.6
    nt.links.new(col, p.inputs["Base Color"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    _MATS["plaster"] = mat
    return mat


def mat_travertine():
    """Honed travertine: warm sand base, horizontal bedding, elongated pores."""
    if "trav" in _MATS:
        return _MATS["trav"]
    mat, nt, out = new_material("Travertine")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    bed = nt.nodes.new("ShaderNodeMapping")
    bed.inputs["Scale"].default_value = (1.5, 1.5, 4.5)  # bedding runs horizontally
    nt.links.new(tc.outputs["Object"], bed.inputs["Vector"])
    # bedding / colour variation
    band = nt.nodes.new("ShaderNodeTexNoise")
    band.inputs["Scale"].default_value = 6.0
    band.inputs["Detail"].default_value = 8.0
    band.inputs["Roughness"].default_value = 0.62
    band.inputs["Distortion"].default_value = 0.4
    nt.links.new(bed.outputs[0], band.inputs["Vector"])
    base = ramp(
        nt,
        band.outputs["Fac"],
        [(0.3, srgb("#D2BDA2")), (0.45, srgb("#DCCAB2")), (0.58, srgb("#E3D3BE")), (0.72, srgb("#D6C3A9"))],
    )
    # pores: small voronoi cells, stretched along the bedding, gated by noise into clusters
    pm_map = nt.nodes.new("ShaderNodeMapping")
    pm_map.inputs["Scale"].default_value = (0.18, 0.9, 1.6)
    nt.links.new(tc.outputs["Object"], pm_map.inputs["Vector"])
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 220.0
    vor.inputs["Randomness"].default_value = 1.0
    nt.links.new(pm_map.outputs[0], vor.inputs["Vector"])
    pits = ramp(nt, vor.outputs["Distance"], [(0.04, (1, 1, 1, 1)), (0.16, (0, 0, 0, 1))])
    gate_n = nt.nodes.new("ShaderNodeTexNoise")
    gate_n.inputs["Scale"].default_value = 30.0
    gate_n.inputs["Detail"].default_value = 3.0
    nt.links.new(bed.outputs[0], gate_n.inputs["Vector"])
    gate = ramp(nt, gate_n.outputs["Fac"], [(0.46, (0, 0, 0, 1)), (0.56, (1, 1, 1, 1))])
    pm = nt.nodes.new("ShaderNodeMath")
    pm.operation = "MULTIPLY"
    nt.links.new(pits, pm.inputs[0])
    nt.links.new(gate, pm.inputs[1])
    col = mix_rgb(nt, pm.outputs[0], base, srgb("#B49C80"))
    # fine grain
    fine = nt.nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 700.0
    fine.inputs["Detail"].default_value = 6.0
    nt.links.new(tc.outputs["Object"], fine.inputs["Vector"])
    mid = nt.nodes.new("ShaderNodeTexNoise")
    mid.inputs["Scale"].default_value = 70.0
    mid.inputs["Detail"].default_value = 5.0
    nt.links.new(bed.outputs[0], mid.inputs["Vector"])
    gsum = nt.nodes.new("ShaderNodeMath")
    gsum.operation = "ADD"
    nt.links.new(fine.outputs["Fac"], gsum.inputs[0])
    nt.links.new(mid.outputs["Fac"], gsum.inputs[1])
    grain = nt.nodes.new("ShaderNodeMath")
    grain.operation = "MULTIPLY"
    grain.inputs[1].default_value = 0.22
    nt.links.new(gsum.outputs[0], grain.inputs[0])
    height = nt.nodes.new("ShaderNodeMath")
    height.operation = "SUBTRACT"
    nt.links.new(grain.outputs[0], height.inputs[0])
    nt.links.new(pm.outputs[0], height.inputs[1])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.0008
    nt.links.new(height.outputs[0], bump.inputs["Height"])
    p = principled(nt, Roughness=0.72, Specular_IOR_Level=0.4)
    p.inputs["Diffuse Roughness"].default_value = 0.4
    nt.links.new(col, p.inputs["Base Color"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    _MATS["trav"] = mat
    return mat


def mat_petal(hex_col, key):
    if key in _MATS:
        return _MATS[key]
    mat, nt, out = new_material("Petal " + key)
    uv = nt.nodes.new("ShaderNodeUVMap")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs[0], sep.inputs[0])
    base_col = ramp(nt, sep.outputs["Y"], [(0.0, srgb("#E9C9B8")), (0.28, srgb(hex_col)), (1.0, srgb(hex_col))])
    # fine veins
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (90.0, 6.0, 1.0)
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 1.0
    n.inputs["Detail"].default_value = 4.0
    nt.links.new(mp.outputs[0], n.inputs["Vector"])
    veins = ramp(nt, n.outputs["Fac"], [(0.35, (0.82, 0.82, 0.82, 1)), (0.65, (1, 1, 1, 1))])
    col = mix_rgb(nt, 1.0, base_col, veins, blend="MULTIPLY")
    p = principled(
        nt,
        Roughness=0.62,
        Specular_IOR_Level=0.3,
        Subsurface_Weight=0.1,
        Subsurface_Radius=(1.0, 0.3, 0.3),
        Subsurface_Scale=0.0006,
        Sheen_Weight=1.0,
        Sheen_Roughness=0.25,
    )
    p.inputs["Sheen Tint"].default_value = (1.0, 0.85, 0.85, 1)
    nt.links.new(col, p.inputs["Base Color"])
    tl = nt.nodes.new("ShaderNodeBsdfTranslucent")
    nt.links.new(col, tl.inputs["Color"])
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = 0.06
    nt.links.new(p.outputs[0], mix.inputs[1])
    nt.links.new(tl.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    _MATS[key] = mat
    return mat


def mat_holdout_black():
    if "gobo" in _MATS:
        return _MATS["gobo"]
    mat, nt, out = new_material("Gobo")
    d = nt.nodes.new("ShaderNodeBsdfDiffuse")
    d.inputs["Color"].default_value = (0.02, 0.02, 0.02, 1)
    nt.links.new(d.outputs[0], out.inputs["Surface"])
    _MATS["gobo"] = mat
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


# --------------------------------------------------------------------------------------------
# Products
# --------------------------------------------------------------------------------------------


def _perfume_outer_profile():
    R = P_R
    fb = 0.0032  # bottom edge fillet
    fs = 0.0075  # shoulder radius
    prof = [(0.0, 0.0)]
    prof += arc(R - fb, fb, fb, -90, 0, 10)
    prof += [(R, P_BODY_TOP - fs)]
    prof += arc(R - fs, P_BODY_TOP - fs, fs, 0, 90, 18)
    # nearly flat top, rising gently to the neck
    top_r = R - fs
    for i in range(1, 9):
        t = i / 9
        prof.append((top_r + (P_NECK_R + 0.0018 - top_r) * t, P_BODY_TOP + 0.0006 * t))
    prof += arc(P_NECK_R + 0.0018, P_BODY_TOP + 0.0006 + 0.0018, 0.0018, -90, -180, 6)
    prof += [(P_NECK_R, P_NECK_TOP)]
    return prof


def _perfume_inner_profile(offset=0.0):
    """Cavity (from the neck down to the thick base). offset > 0 grows it (for the juice)."""
    wall = 0.0026 - offset
    base = 0.0095 - offset
    Ri = P_R - wall
    fi = 0.0045
    fs = 0.0058
    top_i = P_BODY_TOP - 0.0024 + offset
    neck_i = 0.0042 + offset
    prof = [(neck_i, P_NECK_TOP)]
    prof += [(neck_i, top_i + 0.0012)]
    prof += [(Ri - fs, top_i)]
    prof += arc(Ri - fs, top_i - fs, fs, 90, 0, 14)
    prof += [(Ri, base + fi)]
    prof += arc(Ri - fi, base + fi, fi, 0, -90, 10)
    prof += [(0.0, base)]
    return prof


def build_perfume(slug, location=(0, 0, 0), rot_z_deg=0.0, fill=0.93):
    root = link(bpy.data.objects.new(f"perfume-{slug}", None))
    parts = []

    outer = _perfume_outer_profile()
    inner = _perfume_inner_profile()
    # rim on top of the neck closes the solid
    glass = lathe(f"{slug}-glass", outer + inner, segments=192)
    assign(glass, mat_glass())
    parts.append(glass)

    # juice: cavity grown by 0.15 mm into the glass, cut flat at the fill level
    base = 0.0095
    top_cav = P_BODY_TOP - 0.0024
    level = base + (top_cav - base) * fill
    jp = [p for p in reversed(_perfume_inner_profile(offset=0.00015)) if p[1] <= level]
    # find radius at level from the cavity (vertical wall)
    rj = P_R - 0.0026 + 0.00015
    if jp[-1][1] < level:
        jp.append((rj, level))
    # meniscus: tiny lip up the wall
    jp.append((rj - 0.0008, level - 0.00025))
    jp.append((0.0, level - 0.0003))
    juice = lathe(f"{slug}-juice", jp, segments=192)
    assign(juice, mat_juice(slug))
    parts.append(juice)

    # dip tube
    tube = lathe(
        f"{slug}-tube",
        [(0, base + 0.0006), (0.0011, base + 0.0006), (0.0011, P_NECK_TOP), (0, P_NECK_TOP)],
        segments=32,
    )
    assign(tube, mat_acrylic())
    parts.append(tube)

    # crimp ferrule inside the collar
    ferrule = lathe(
        f"{slug}-ferrule",
        [(0, P_NECK_TOP - 0.0030), (0.0095, P_NECK_TOP - 0.0030), (0.0097, P_NECK_TOP - 0.0024),
         (0.0097, P_NECK_TOP + 0.0006), (0.0091, P_NECK_TOP + 0.0012), (0, P_NECK_TOP + 0.0012)],
        segments=96,
    )
    assign(ferrule, mat_metal("Ferrule", "#C9C1B4", rough=0.35))
    parts.append(ferrule)

    # clear collar with softly rounded edges
    cr = P_COLLAR_R
    f = 0.0016
    collar_prof = [(0, P_COLLAR_Z0)]
    collar_prof += arc(cr - f, P_COLLAR_Z0 + f, f, -90, 0, 6)
    collar_prof += arc(cr - f, P_COLLAR_Z1 - f, f, 0, 90, 6)
    collar_prof += [(0, P_COLLAR_Z1)]
    collar = lathe(f"{slug}-collar", collar_prof, segments=160)
    assign(collar, mat_acrylic())
    parts.append(collar)

    # stem + ball cap
    stem = lathe(
        f"{slug}-stem",
        [(0, P_COLLAR_Z1 - 0.0002), (0.0052, P_COLLAR_Z1 - 0.0002), (0.0052, P_COLLAR_Z1 + 0.004), (0, P_COLLAR_Z1 + 0.004)],
        segments=64,
    )
    assign(stem, mat_ball())
    parts.append(stem)
    cz = P_COLLAR_Z1 + 0.0015 + P_BALL_R
    ball_prof = arc(0, cz, P_BALL_R, -90, 90, 72)
    ball_prof[0] = (0.0, ball_prof[0][1])
    ball_prof[-1] = (0.0, ball_prof[-1][1])
    ball = lathe(f"{slug}-ball", ball_prof, segments=160)
    assign(ball, mat_ball())
    parts.append(ball)

    # printed decal on the front (42 x 40 mm), sitting 0.06 mm proud of the glass
    decal = _cyl_patch(f"{slug}-print", P_R + 0.00006, 0.042, 0.040, z_center=0.0302)
    assign(decal, mat_perfume_ink(slug))
    parts.append(decal)

    for p in parts:
        p.parent = root
        p["solei_product"] = True
    root.location = location
    root.rotation_euler = (0, 0, math.radians(rot_z_deg))
    return root


def _cyl_patch(name, radius, width, height, z_center, nu=96, nv=8):
    span = width / radius
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    grid = []
    for j in range(nv + 1):
        row = []
        z = z_center - height / 2 + height * j / nv
        for i in range(nu + 1):
            t = -span / 2 + span * i / nu
            row.append(bm.verts.new((radius * math.sin(t), -radius * math.cos(t), z)))
        grid.append(row)
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uv].uv = (a / nu, b / nv)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return link(bpy.data.objects.new(name, me))


def build_spray(slug, location=(0, 0, 0), rot_z_deg=0.0, lying=False):
    root = link(bpy.data.objects.new(f"spray-{slug}", None))
    R = S_R
    fb = 0.0012
    body_prof = [(0, 0)] + arc(R - fb, fb, fb, -90, 0, 6) + [(R, S_BODY_TOP - 0.0004), (R - 0.0003, S_BODY_TOP), (0, S_BODY_TOP)]
    body = lathe(f"{slug}-body", body_prof, segments=256, uv_mode="wrap", v_range=(0.0, S_BODY_TOP))
    assign(body, mat_spray_body(slug))

    band = lathe(
        f"{slug}-band",
        [(0, S_BODY_TOP + 0.0001), (R - 0.0002, S_BODY_TOP + 0.0001), (R + 0.00005, S_BODY_TOP + 0.0004),
         (R + 0.00005, S_BAND_TOP - 0.0003), (R - 0.0002, S_BAND_TOP), (0, S_BAND_TOP)],
        segments=256,
    )
    assign(band, mat_gold_band())

    ft = 0.0032
    dome = 0.0009
    cap_prof = [(0, S_BAND_TOP), (R - 0.0003, S_BAND_TOP), (R, S_BAND_TOP + 0.0003), (R, S_HEIGHT - ft - dome)]
    cap_prof += arc(R - ft, S_HEIGHT - ft - dome, ft, 0, 70, 10)
    # gentle dome to the centre
    x0, z0 = cap_prof[-1]
    for i in range(1, 13):
        t = i / 12
        cap_prof.append((x0 * (1 - t), z0 + (S_HEIGHT - z0) * math.sin(t * math.pi / 2)))
    cap = lathe(f"{slug}-cap", cap_prof, segments=256)
    assign(cap, mat_spray_cap())

    for p in (body, band, cap):
        p.parent = root
        p["solei_product"] = True
    if lying:
        # On its side with the cap to the right, so the vertical wordmark reads left-to-right.
        # `lying` is the roll (deg) about the tube's own axis; negative turns the print upwards.
        roll = float(lying) if not isinstance(lying, bool) else -20.0
        for p in (body, band, cap):
            p.rotation_euler = (0, 0, math.radians(roll))
        root.matrix_world = (
            Matrix.Translation((location[0], location[1], location[2] + R + 0.00005))
            @ Matrix.Rotation(math.radians(rot_z_deg), 4, "Z")
            @ Matrix.Rotation(math.radians(90), 4, "Y")
        )
    else:
        root.location = location
        root.rotation_euler = (0, 0, math.radians(rot_z_deg))
    return root


# --------------------------------------------------------------------------------------------
# Set pieces
# --------------------------------------------------------------------------------------------


def build_room(wall_y=0.35, width=4.0, cove=0.06):
    """Floor + back wall with a small cove, cream plaster."""
    bm = bmesh.new()
    prof = [(-3.0, 0.0)]
    # floor goes from y=-3 to the cove, then up the wall
    for i in range(0, 13):
        a = math.radians(-90 + 90 * i / 12)
        prof.append((wall_y - cove + cove * math.cos(a) * 1.0, cove + cove * math.sin(a)))
    prof.append((wall_y, 3.0))
    verts = []
    for x in (-width / 2, width / 2):
        verts.append([bm.verts.new((x, y, z)) for y, z in prof])
    for i in range(len(prof) - 1):
        bm.faces.new((verts[0][i], verts[1][i], verts[1][i + 1], verts[0][i + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < -0.1 or f.normal.y > 0.1:
            f.normal_flip()
    me = bpy.data.meshes.new("room")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    obj = link(bpy.data.objects.new("room", me))
    assign(obj, mat_plaster())
    return obj


def build_arch(center_x, wall_y, bottom_z, width, height, line=0.007, depth=0.004, gap=0.022, double=True):
    """Thin arch outline in relief on the wall (brand motif). Returns list of objects."""
    objs = []
    rings = [(width, height)]
    if double:
        rings.append((width - 2 * (line + gap), height - (line + gap)))
    for k, (w, h) in enumerate(rings):
        objs.append(_arch_ring(f"arch{k}", center_x, wall_y, bottom_z, w, h, line, depth))
    return objs


def _arch_outline(w, h, n=48):
    r = w / 2
    pts = [(-r, 0.0), (-r, h - r)]
    for i in range(1, n):
        a = math.pi - math.pi * i / n
        pts.append((r * math.cos(a), h - r + r * math.sin(a)))
    pts += [(r, h - r), (r, 0.0)]
    return pts


def _arch_ring(name, cx, wall_y, z0, w, h, line, depth):
    outer = _arch_outline(w, h)
    inner = _arch_outline(w - 2 * line, h - line)
    bm = bmesh.new()

    def v(p, d):
        return bm.verts.new((cx + p[0], wall_y - d, z0 + p[1]))

    o0 = [v(p, 0) for p in outer]
    i0 = [v(p, 0) for p in inner]
    o1 = [v(p, depth) for p in outer]
    i1 = [v(p, depth) for p in inner]
    n = len(outer)
    for a in range(n - 1):
        b = a + 1
        bm.faces.new((o1[a], o1[b], i1[b], i1[a]))  # front
        bm.faces.new((o0[a], o0[b], o1[b], o1[a]))  # outer side
        bm.faces.new((i0[a], i1[a], i1[b], i0[b]))  # inner side
    # ends
    bm.faces.new((o0[0], o1[0], i1[0], i0[0]))
    bm.faces.new((o0[-1], i0[-1], i1[-1], o1[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = 0.0012
    mod.segments = 3
    assign(obj, mat_plaster())
    return obj


def build_sun_disc(cx, wall_y, cz, r=0.03, line=0.005, depth=0.004):
    prof_outer = []
    bm = bmesh.new()
    n = 64
    o0, i0, o1, i1 = [], [], [], []
    for k in range(n):
        a = 2 * math.pi * k / n
        for lst, rr, d in ((o0, r, 0), (i0, r - line, 0), (o1, r, depth), (i1, r - line, depth)):
            lst.append(bm.verts.new((cx + rr * math.cos(a), wall_y - d, cz + rr * math.sin(a))))
    for a in range(n):
        b = (a + 1) % n
        bm.faces.new((o1[a], o1[b], i1[b], i1[a]))
        bm.faces.new((o0[a], o0[b], o1[b], o1[a]))
        bm.faces.new((i0[a], i1[a], i1[b], i0[b]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("sun")
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new("sun-disc", me))
    assign(obj, mat_plaster())
    del prof_outer
    return obj


def build_block(name, size, location, rot_z=0.0, bevel=0.003):
    b = rounded_box(name, size, bevel=bevel)
    b.location = location
    b.rotation_euler = (0, 0, math.radians(rot_z))
    assign(b, mat_travertine())
    return b


def build_plinth(location, radius=0.075, height=0.024):
    f = 0.0025
    prof = [(0, 0)] + arc(radius - f, f, f, -90, 0, 5) + arc(radius - f, height - f, f, 0, 90, 5) + [(0, height)]
    p = lathe("plinth", prof, segments=192)
    p.location = location
    assign(p, mat_travertine())
    return p


def build_petal(location, rot_deg, size=0.026, color="#5E0F26", key="burgundy", seed=0, curl=0.5):
    """A rose petal: narrow claw at the base, broad rounded blade, cupped with a rolled lip."""
    rnd = random.Random(seed)
    nu, nv = 24, 20
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    grid = []
    lean = rnd.uniform(-0.15, 0.15)
    for j in range(nv + 1):
        v = j / nv
        w = 0.18 + 0.82 * math.sin(math.pi * 0.5 * min(1.0, v / 0.6)) ** 0.9
        if v > 0.6:
            w *= math.sqrt(max(0.0, 1 - ((v - 0.6) / 0.4) ** 2)) * 0.97 + 0.03
        row = []
        for i in range(nu + 1):
            u = (i / nu - 0.5) * 2
            x = (u * w * 0.5 + lean * v * v) * size
            y = v * size
            # cup across, lift towards the tip, lip rolled back at the edges
            z = (curl * (u * w) ** 2 * 0.35 + 0.22 * v ** 2 + 0.18 * (abs(u) ** 3) * v ** 2) * size
            z += rnd.uniform(-1, 1) * size * 0.0015
            row.append((bm.verts.new((x, y - size * 0.5, z)), (i / nu, v)))
        grid.append(row)
    for j in range(nv):
        for i in range(nu):
            quad = (grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])
            f = bm.faces.new([q[0] for q in quad])
            for loop, q in zip(f.loops, quad):
                loop[uvl].uv = q[1]
    me = bpy.data.meshes.new("petal")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    obj = link(bpy.data.objects.new("petal", me))
    sol = obj.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.00035
    sol.offset = 1.0
    obj.location = location
    obj.rotation_euler = rot_deg if isinstance(rot_deg, tuple) else (0, 0, math.radians(rot_deg))
    assign(obj, mat_petal(color, key))
    return obj


# --------------------------------------------------------------------------------------------
# Lighting
# --------------------------------------------------------------------------------------------


def _frond(bm, base, direction, length, droop, rnd, leaflets=22):
    """One palm frond: a drooping rachis with long thin leaflets on both sides."""
    d = Vector(direction).normalized()
    side = d.cross(Vector((0, 0, 1)))
    if side.length < 1e-3:
        side = Vector((1, 0, 0))
    side.normalize()
    up = side.cross(d).normalized()

    def spine(t):
        return Vector(base) + d * (length * t) - up * (droop * length * t * t)

    for k in range(leaflets):
        t = 0.12 + 0.86 * k / leaflets
        p = spine(t)
        tang = (spine(min(1, t + 0.01)) - spine(max(0, t - 0.01))).normalized()
        ll = length * (0.42 * math.sin(math.pi * min(1, t * 1.05)) + 0.06) * rnd.uniform(0.85, 1.1)
        for s in (-1, 1):
            ang = math.radians(rnd.uniform(38, 55))
            out = (tang * math.cos(ang) + side * s * math.sin(ang)).normalized()
            out = (out - up * rnd.uniform(0.15, 0.45)).normalized()
            w = 0.016 * length * rnd.uniform(0.8, 1.25)
            tip = p + out * ll
            n = 6
            prev = None
            for i in range(n + 1):
                f = i / n
                c = p + out * (ll * f) - up * (0.12 * ll * f * f)
                half = w * (1 - f) ** 0.7 * (0.6 + 1.6 * f * (1 - f))
                perp = out.cross(up).normalized() * half
                a = bm.verts.new(c - perp)
                b = bm.verts.new(c + perp)
                if prev:
                    bm.faces.new((prev[0], prev[1], b, a))
                prev = (a, b)
            del tip
    # rachis as a thin strip
    prev = None
    for i in range(21):
        t = i / 20
        c = spine(t)
        perp = side * 0.006 * (1 - 0.7 * t)
        a = bm.verts.new(c - perp)
        b = bm.verts.new(c + perp)
        if prev:
            bm.faces.new((prev[0], prev[1], b, a))
        prev = (a, b)


def build_palm_gobo(center, normal, scale=1.0, seed=7, fronds=5, roll_deg=0.0):
    """Palm crown silhouette in a plane facing `normal`, placed at `center` (only casts shadows)."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    # build in local XY (frond plane), project later
    for k in range(fronds):
        ang = math.radians(-70 + 140 * k / max(1, fronds - 1) + rnd.uniform(-12, 12))
        direction = (math.cos(ang), math.sin(ang) * 0.35, math.sin(ang))
        _frond(bm, (0, 0, 0), direction, 0.85 * scale * rnd.uniform(0.85, 1.1), 0.25, rnd)
    me = bpy.data.meshes.new("gobo")
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new("palm-gobo", me))
    assign(obj, mat_holdout_black())
    set_visibility(obj, camera=False, diffuse=False, glossy=False, transmission=False, shadow=True)
    obj.location = center
    # orient: local +Y faces the light normal
    n = Vector(normal).normalized()
    q = n.to_track_quat("Y", "Z") @ Quaternion((0, 1, 0), math.radians(roll_deg))
    obj.rotation_euler = q.to_euler()
    return obj


def add_area(name, location, target, size, size_y=None, energy=10.0, color=(1, 1, 1), visible_diffuse=True, spread=180):
    light = bpy.data.lights.new(name, "AREA")
    light.shape = "RECTANGLE" if size_y else "SQUARE"
    light.size = size
    if size_y:
        light.size_y = size_y
    light.energy = energy
    light.color = color
    light.spread = math.radians(spread)
    obj = link(bpy.data.objects.new(name, light))
    obj.location = location
    direction = Vector(target) - Vector(location)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    obj.visible_diffuse = visible_diffuse
    return obj


def add_sun(direction_to_light, strength=4.0, angle_deg=0.6, color=(1.0, 0.80, 0.60), name="sun"):
    light = bpy.data.lights.new(name, "SUN")
    light.energy = strength
    light.angle = math.radians(angle_deg)
    light.color = color
    obj = link(bpy.data.objects.new(name, light))
    d = Vector(direction_to_light).normalized()
    # sun shines along its -Z
    obj.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return obj


def setup_world(strength=0.35, color="#F2E4D8"):
    world = bpy.data.worlds.new("studio")
    bpy.context.scene.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    nt = world.node_tree
    bg = nt.nodes.get("Background") or nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = srgb(color)
    bg.inputs["Strength"].default_value = strength
    out = nt.nodes.get("World Output") or nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs[0], out.inputs["Surface"])


def add_flag(name, location, target, w, h):
    """Black card seen only in reflections/refraction — gives glass its dark edge definition."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in bm.verts:
        v.co.x *= w
        v.co.y *= h
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("Z", "Y").to_euler()
    assign(obj, mat_holdout_black())
    set_visibility(obj, camera=False, diffuse=False, glossy=True, transmission=True, shadow=False)
    return obj


def studio_lighting(focus=(0, 0, 0.06), sun_dir=(-0.75, -0.55, 0.42), sun_strength=4.5, gobo_target=None,
                    gobo_dist=0.8, gobo_scale=1.0, strips=True, strip_span=0.30, strip_energy=14.0,
                    fill=2.0, seed=7, flags=True, flag_span=0.42, product_sun_dir=None, kicker=6.0, gobo_roll=0.0):
    f = Vector(focus)
    sd = Vector(sun_dir).normalized()
    # Two identical suns: one lights the set through the palm gobo, the other lights only the
    # products and ignores the gobo — so leaf shadows dapple the wall but never cover a label.
    add_sun(sd, strength=sun_strength, name="sun-set")
    psd = Vector(product_sun_dir).normalized() if product_sun_dir else sd
    add_sun(psd, strength=sun_strength, name="sun-product")
    gt = Vector(gobo_target) if gobo_target else f
    build_palm_gobo(gt + sd * gobo_dist, sd, scale=gobo_scale, seed=seed, roll_deg=gobo_roll)
    # large soft fill from camera right (warm bounce)
    fl = add_area("fill", (f.x + 0.9, f.y - 1.1, f.z + 0.4), f, 0.6, energy=fill * 12, color=(0.96, 0.95, 0.97))
    # soft top light (kept out of reflections so the lacquer cap stays deep)
    top = add_area("top", (f.x - 0.1, f.y - 0.15, f.z + 1.0), f, 0.8, energy=fill * 5, color=(1.0, 0.96, 0.92))
    top.visible_glossy = False
    del fl
    if strips:
        # tall strip boxes for long glass highlights; invisible to diffuse so they don't flatten the light
        for sx in (-1, 1):
            add_area(
                f"strip{sx}",
                (f.x + sx * strip_span, f.y + 0.06, f.z + 0.03),
                (f.x, f.y, f.z + 0.02),
                0.05,
                size_y=0.45,
                energy=strip_energy,
                color=(1.0, 0.97, 0.94),
                visible_diffuse=False,
            )
    # small kicker seen only in reflections: crisp highlight on the lacquer ball and glass shoulders
    add_area("kicker", (f.x - 0.35, f.y - 0.45, f.z + 0.45), f, 0.12, energy=kicker, color=(1.0, 0.95, 0.9))
    if flags:
        for sx in (-1, 1):
            add_flag(f"flag{sx}", (f.x + sx * flag_span, f.y - 0.02, f.z), f, 0.35, 0.6)


def finalize_light_linking():
    """Wire the sun pair (see studio_lighting) once every object exists."""
    sun_set = bpy.data.objects.get("sun-set")
    sun_prod = bpy.data.objects.get("sun-product")
    prod = bpy.data.collections.new("ll-products")
    rest = bpy.data.collections.new("ll-set")
    for o in bpy.context.scene.objects:
        if o.type != "MESH":
            continue
        (prod if o.get("solei_product") else rest).objects.link(o)
    if sun_set and sun_prod:
        # set sun: lights everything except products; everything (incl. gobo) blocks it
        sun_set.light_linking.receiver_collection = rest
        # product sun: lights products only; only products block it (gobo ignored)
        sun_prod.light_linking.receiver_collection = prod
        sun_prod.light_linking.blocker_collection = prod
    # reflection-only helpers (strip boxes, kicker) touch the products only
    for o in bpy.context.scene.objects:
        if o.type == "LIGHT" and (o.name.startswith("strip") or o.name == "kicker"):
            o.light_linking.receiver_collection = prod
            o.visible_camera = False


# --------------------------------------------------------------------------------------------
# Camera + render settings
# --------------------------------------------------------------------------------------------


def add_camera(location, target, lens=85.0, fstop=8.0, focus=None, shift=(0.0, 0.0)):
    cam = bpy.data.cameras.new("cam")
    cam.lens = lens
    cam.sensor_width = 36.0
    cam.shift_x, cam.shift_y = shift
    cam.dof.use_dof = True
    cam.dof.aperture_fstop = fstop
    cam.dof.aperture_blades = 9
    obj = link(bpy.data.objects.new("cam", cam))
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    cam.dof.focus_distance = (Vector(focus or target) - Vector(location)).length
    bpy.context.scene.camera = obj
    return obj


def configure_render(width, height, samples=384, use_gpu=True, threshold=0.012):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    cy = scene.cycles
    device = "CPU"
    if use_gpu:
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences
            prefs.compute_device_type = "METAL"
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == "METAL"]
            for d in prefs.devices:
                d.use = d.type == "METAL"
            if gpus:
                device = "GPU"
        except Exception as e:  # pragma: no cover
            print("GPU unavailable, using CPU:", e)
    cy.device = device
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = threshold
    cy.adaptive_min_samples = 64
    cy.use_denoising = True
    cy.denoiser = "OPENIMAGEDENOISE"
    cy.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    cy.denoising_prefilter = "ACCURATE"
    try:
        cy.denoising_quality = "HIGH"
        cy.denoising_use_gpu = device == "GPU"
    except Exception:
        pass
    cy.max_bounces = 24
    cy.diffuse_bounces = 4
    cy.glossy_bounces = 8
    cy.transmission_bounces = 18
    cy.transparent_max_bounces = 24
    cy.volume_bounces = 2
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.sample_clamp_direct = 0.0
    cy.sample_clamp_indirect = 6.0
    cy.blur_glossy = 0.3
    cy.use_light_tree = True
    cy.film_exposure = 1.0
    scene.render.film_transparent = False
    vs = scene.view_settings
    scene.display_settings.display_device = "sRGB"
    vs.view_transform = "AgX"
    vs.look = "AgX - Medium High Contrast"
    vs.exposure = -0.2
    vs.gamma = 1.0
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_depth = "16"
    scene.render.image_settings.color_mode = "RGB"
    return device
