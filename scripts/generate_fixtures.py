"""Exports the reference algorithm's results for the TypeScript parity tests.

The TypeScript in src/core/ is a port of reference/corrigir_geometria.py, and
PLANO.md §7 holds it to the reference at 0.01 px. This script runs the
reference's own functions, unchanged, on fixed parameters and writes what they
return to tests/fixtures/parity.json: the levelling rotation, the output
framing, the source coordinates of a grid of output pixels, the number of
valid pixels and the crop rectangles. It also writes a synthetic photo, a
facade grid seen by the reference case's camera, and the reference's own
correction of it (tests/fixtures/grid-960x1280*.png), which the browser tests
compare with the shader's.

There is no randomness and no photo. Each case builds its vanishing point from
a known pitch and roll, which is how the plan's reference case (§3.8, a photo
that is not in the repository) is reproduced: pitch 17.5 and roll 0.8 degrees
give its 711x1016 output.

    python scripts/generate_fixtures.py           write the fixtures
    python scripts/generate_fixtures.py --check   compare with the committed
                                                  file (CI), within 1e-9

--check compares numbers within a tolerance rather than text, because the
last bit of a sine can differ between two builds of NumPy on two machines; the
integers (sizes, counts, rectangles) must be equal, and so must every pixel
of the two images.
"""

import argparse
import hashlib
import json
import math
import pathlib
import sys

import cv2
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "reference"))
sys.dont_write_bytecode = True

import corrigir_geometria as ref  # noqa: E402  (the path is set just above)

OUT = ROOT / "tests" / "fixtures" / "parity.json"
TOLERANCE = 1e-9

# (name, width, height, focal px, pitch deg, roll deg, strength, panini d,
# vertical compression, crop proportions). Pitch > 0 is a camera that pointed
# down, pitch < 0 one that pointed up. Pitch None means no levelling: the
# vanishing point at infinity straight down, which gives the identity.
CASES = [
    ("reference-case", 960, 1280, 480.0, 17.5, 0.8, 0.9, 0.7, 0.5, [0.7, 0.75]),
    ("landscape-rectilinear", 1600, 1200, 600.0, 10.0, -3.0, 1.0, 0.0, 0.0, [1.0, 1.5]),
    ("portrait-tilted-up", 1200, 1600, 24 / 43.27 * 2000, -20.0, 5.0, 1.0, 1.0, 1.0, [0.5625]),
    ("no-levelling", 1000, 750, 0.30 * 1250, None, None, 1.0, 0.5, 0.3, [0.8]),
]


def vanishing_point(pitch_deg, roll_deg, focal, cx, cy):
    """Homogeneous vertical vanishing point of a camera with this pitch and roll.

    Inverts rotacao_de_nivelamento: pitch = asin(down.z) and
    roll = atan2(-down.x, down.y), with down = (vx - cx vw, vy - cy vw, f vw).
    """
    if pitch_deg is None:
        return np.array([0.0, 1.0, 0.0])
    p, r = math.radians(pitch_deg), math.radians(roll_deg)
    down = np.array([-math.sin(r) * math.cos(p), math.cos(r) * math.cos(p), math.sin(p)])
    vw = down[2] / focal
    return np.array([down[0] + cx * vw, down[1] + cy * vw, vw])


def floats(a):
    """A list of plain floats, so json writes the shortest exact repr."""
    return [float(x) for x in np.asarray(a).ravel()]


def case(name, width, height, focal, pitch, roll, strength, d, c, aspects):
    """Runs the reference on one set of parameters."""
    cx, cy = (width - 1) / 2.0, (height - 1) / 2.0
    vp = vanishing_point(pitch, roll, focal, cx, cy)
    rot, pitch_deg, roll_deg = ref.rotacao_de_nivelamento(vp, focal, cx, cy)
    rot_full = rot.copy()
    if strength < 1.0:  # as principal() does it
        vector, _ = cv2.Rodrigues(rot)
        rot, _ = cv2.Rodrigues(vector * strength)

    image = np.zeros((height, width), np.uint8)
    _, valid = ref.reprojetar(image, focal, rot, d=d, compressao_vertical=c, margem=1.0)
    out_h, out_w = valid.shape

    # The framing, recomputed exactly as reprojetar does it (it does not
    # return it): the projected contour of the source image.
    def compress(y):
        return y if c <= 0 else np.arctan(y * c) / c

    bx = np.concatenate([
        np.linspace(0, width - 1, 200), np.full(200, width - 1),
        np.linspace(width - 1, 0, 200), np.zeros(200),
    ])
    by = np.concatenate([
        np.zeros(200), np.linspace(0, height - 1, 200),
        np.full(200, height - 1), np.linspace(height - 1, 0, 200),
    ])
    rays = np.stack([(bx - cx) / focal, (by - cy) / focal, np.ones_like(bx)], axis=-1)
    plane = ref.projetar_panini(rays @ rot, d)
    plane[:, 1] = compress(plane[:, 1])
    x_min, y_min = plane.min(axis=0)
    x_max, y_max = plane.max(axis=0)

    # Source coordinates of a grid of output pixels, the corners and the
    # centre included: 21 x 21 samples. -1 marks a ray behind the camera.
    def expand(y):
        if c <= 0:
            return y
        limit = np.pi / 2 - 1e-3
        return np.tan(np.clip(y * c, -limit, limit)) / c

    cols = np.unique(np.round(np.linspace(0, out_w - 1, 21)).astype(int))
    rows = np.unique(np.round(np.linspace(0, out_h - 1, 21)).astype(int))
    gx, gy = np.meshgrid(cols, rows)
    xs = x_min + (gx + 0.5) / focal
    ys = y_min + (gy + 0.5) / focal
    r = ref.raios_panini(xs, expand(ys), d) @ rot.T
    front = r[..., 2] > 1e-6
    u = np.where(front, focal * r[..., 0] / r[..., 2] + cx, -1)
    v = np.where(front, focal * r[..., 1] / r[..., 2] + cy, -1)
    samples = [
        [int(px), int(py), float(uu), float(vv)]
        for px, py, uu, vv in zip(gx.ravel(), gy.ravel(), u.ravel(), v.ravel())
    ]

    crops = {"free": [int(k) for k in ref.maior_retangulo_valido(valid)]}
    for aspect in aspects:
        crops[repr(aspect)] = [int(k) for k in ref.maior_retangulo_com_aspecto(valid, aspect)]

    return {
        "name": name,
        "width": width,
        "height": height,
        "focal": float(focal),
        "vanishingPoint": floats(vp),
        "strength": strength,
        "paniniD": d,
        "compression": c,
        "margin": 1.0,
        "pitchDeg": float(pitch_deg),
        "rollDeg": float(roll_deg),
        "rotationFull": floats(rot_full),
        "rotation": floats(rot),
        "framing": {
            "xMin": float(x_min), "yMin": float(y_min),
            "xMax": float(x_max), "yMax": float(y_max),
            "width": out_w, "height": out_h,
        },
        "samples": samples,
        "validCount": int(valid.sum()),
        "crops": crops,
    }


def panini_pairs():
    """Rays and their Panini plane coordinates, for d in {0, 0.5, 1}."""
    lons = np.radians(np.linspace(-80, 80, 9))
    lats = np.radians(np.linspace(-60, 60, 7))
    lon, lat = np.meshgrid(lons, lats)
    rays = np.stack([np.cos(lat) * np.sin(lon), np.sin(lat), np.cos(lat) * np.cos(lon)], axis=-1)
    out = []
    for d in (0.0, 0.5, 1.0):
        plane = ref.projetar_panini(rays, d)
        back = ref.raios_panini(plane[..., 0], plane[..., 1], d)
        out.append({
            "d": d,
            "rays": [floats(x) for x in rays.reshape(-1, 3)],
            "plane": [floats(x) for x in plane.reshape(-1, 2)],
            "back": [floats(x) for x in back.reshape(-1, 3)],
        })
    return out


GRID_PNG = ROOT / "tests" / "fixtures" / "grid-960x1280.png"
GRID_CORRECTED_PNG = ROOT / "tests" / "fixtures" / "grid-960x1280-corrected.png"


def synthetic_grid(width, height, focal, pitch_deg, roll_deg, supersample=4):
    """A facade grid, photographed by a camera with this pitch and roll.

    The facade is the plane z = 4 in the level camera's frame, with a line
    every 0.5 units in x and in y, 0.03 units wide: about 60 px apart and 3.6 px
    wide at f = 480. Each pixel averages supersample x supersample rays, so the
    lines are anti-aliased by arithmetic alone, the same on every machine (no
    font, no drawing library).

    The vertical lines are red and the horizontal ones blue, over a background
    of grey 40: red is 40 + 180 x the vertical lines' coverage, blue the same
    with the horizontal lines, green 40 everywhere. The browser tests can then
    find each family in its own channel without the other crossing it, and a
    swap of channels cannot pass unseen.
    """
    cx, cy = (width - 1) / 2.0, (height - 1) / 2.0
    p, r = math.radians(pitch_deg), math.radians(roll_deg)
    rx = np.array([[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]])
    rz = np.array([[math.cos(r), -math.sin(r), 0], [math.sin(r), math.cos(r), 0], [0, 0, 1]])
    camera = rz @ rx  # level camera rays to this camera's rays
    ys, xs = np.mgrid[0:height, 0:width].astype(np.float64)
    offsets = (np.arange(supersample) + 0.5) / supersample - 0.5
    verticals = np.zeros((height, width))
    horizontals = np.zeros((height, width))
    for dy in offsets:
        for dx in offsets:
            rays = np.stack([(xs + dx - cx) / focal, (ys + dy - cy) / focal, np.ones_like(xs)], -1)
            level = rays @ camera  # camera^T r, row by row
            t = 4.0 / level[..., 2]
            gx = level[..., 0] * t / 0.5
            gy = level[..., 1] * t / 0.5
            verticals += np.abs(gx - np.round(gx)) < 0.03
            horizontals += np.abs(gy - np.round(gy)) < 0.03
    samples = supersample * supersample
    red = np.round(40 + 180 * verticals / samples)
    blue = np.round(40 + 180 * horizontals / samples)
    green = np.full((height, width), 40.0)
    return np.stack([blue, green, red], -1).astype(np.uint8)  # OpenCV's order: BGR


def grid_images():
    """The synthetic photo of the reference case, and the reference's correction of it."""
    name, width, height, focal, pitch, roll, strength, d, c, _ = CASES[0]
    cx, cy = (width - 1) / 2.0, (height - 1) / 2.0
    grid = synthetic_grid(width, height, focal, pitch, roll)
    rot, _, _ = ref.rotacao_de_nivelamento(vanishing_point(pitch, roll, focal, cx, cy), focal, cx, cy)
    if strength < 1.0:
        vector, _ = cv2.Rodrigues(rot)
        rot, _ = cv2.Rodrigues(vector * strength)
    corrected, _ = ref.reprojetar(grid, focal, rot, d=d, compressao_vertical=c, margem=1.0)
    return grid, corrected


def generate():
    """Everything the parity tests read."""
    sha = hashlib.sha256((ROOT / "reference" / "corrigir_geometria.py").read_bytes()).hexdigest()
    return {
        "_": "GENERATED by scripts/generate_fixtures.py from reference/corrigir_geometria.py. Do not edit.",
        "referenceSha256": sha,
        "numpy": np.__version__,
        "opencv": cv2.__version__,
        "cases": [case(*c) for c in CASES],
        "panini": panini_pairs(),
    }


def differences(want, got, path="$"):
    """Where two fixture trees differ: integers exactly, floats within TOLERANCE."""
    if isinstance(want, dict) and isinstance(got, dict):
        if want.keys() != got.keys():
            return [f"{path}: keys {sorted(want)} != {sorted(got)}"]
        return [d for k in want for d in differences(want[k], got[k], f"{path}.{k}")]
    if isinstance(want, list) and isinstance(got, list):
        if len(want) != len(got):
            return [f"{path}: length {len(want)} != {len(got)}"]
        return [d for i, (a, b) in enumerate(zip(want, got)) for d in differences(a, b, f"{path}[{i}]")]
    if isinstance(want, float) or isinstance(got, float):
        if not math.isclose(want, got, rel_tol=TOLERANCE, abs_tol=TOLERANCE):
            return [f"{path}: {want!r} != {got!r}"]
        return []
    return [] if want == got else [f"{path}: {want!r} != {got!r}"]


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--check", action="store_true", help="compare instead of writing")
    args = parser.parse_args()
    data = generate()
    if args.check:
        committed = json.loads(OUT.read_text())
        # The versions are a record, not a result: compared apart, as a warning.
        for key in ("numpy", "opencv"):
            if committed.get(key) != data[key]:
                print(f"FIXTURES: note, generated with {key} {committed.get(key)}, now {data[key]}")
            committed[key] = data[key]
        found = differences(committed, data)
        for path, image in zip((GRID_PNG, GRID_CORRECTED_PNG), grid_images()):
            written = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
            if written is None or written.shape != image.shape:
                found.append(f"{path.name}: missing, or not {image.shape}")
                continue
            # Exactly: both images are integers from deterministic arithmetic,
            # so a last bit that differs either changes nothing or crosses a
            # rounding boundary, and then a pixel moves by levels, not by one
            # (a supersample of the grid is 11 levels; OpenCV's remap rounds
            # the sampling position to 1/32 px). No tolerance has been
            # measured: if CI ever disagrees, its numbers set one.
            changed = np.argwhere(written != image)
            if len(changed):
                worst = int(np.abs(written.astype(int) - image.astype(int)).max())
                at = changed[0].tolist()
                found.append(f"{path.name}: {len(changed)} values differ, by up to {worst}, first at {at}")
        for line in found[:50]:
            print(f"FIXTURES: {line}")
        if found:
            print(f"FIXTURES: {len(found)} difference(s): run python scripts/generate_fixtures.py")
            sys.exit(1)
        print(f"FIXTURES: in sync ({len(data['cases'])} cases within {TOLERANCE}, 2 images exactly)")
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    print(f"FIXTURES: wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} B)")
    for path, image in zip((GRID_PNG, GRID_CORRECTED_PNG), grid_images()):
        cv2.imwrite(str(path), image, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        print(f"FIXTURES: wrote {path.relative_to(ROOT)} ({path.stat().st_size} B)")


if __name__ == "__main__":
    main()
