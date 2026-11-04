"""Bake the map's ground layers: land, water depth and relief, in the site's Albers USA frame.

Decoration only. Nothing here is data the site reports; it gives the 3-D map a coast, an ocean and terrain
outside the states. State shapes and heights come from elsewhere and are not touched.

Sources (all public domain):
- US land: us-atlas 3.0.1, nation-10m.json (Census cartographic boundaries), read from web/node_modules.
- Other land and lakes: Natural Earth 1:50m land and lakes, natural-earth-vector tag v5.1.2 (GeoJSON).
- Elevation and bathymetry: AWS Terrain Tiles (Mapzen terrarium encoding), zoom 5.

Outputs in web/public/geo/:
- mask-4096.png, mask-2048.png: RGB. R = land, G = US land, B = lakes.
- depth-1024.webp: grayscale water depth, sqrt(depth / 6000 m); 0 on land and lakes.
- relief-2048.webp: grayscale hillshade of land and sea floor, 128 = flat, lit from the northwest.

Inside the Alaska inset, land Natural Earth leaves out here (Chukotka, which spans the antimeridian) comes from
the elevation tiles instead (elevation above 0 m).

The frame matches d3.geoAlbersUsa().scale(1300).translate([487.5, 305]) in web/src/engine/engine.ts:
the lower 48 use d3's Albers conic; the Alaska and Hawaii inset boxes use d3's inset projections, so the
insets show their own surroundings (Alaska with the Yukon and BC coast, Hawaii in open ocean).

Run: .venv/bin/python scripts/build_geo_layers.py [--cache DIR]
"""

from __future__ import annotations

import argparse
import io
import json
import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "geo"
US_ATLAS = ROOT / "web" / "node_modules" / "us-atlas" / "nation-10m.json"
NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/{}.geojson"
TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
ZOOM = 5

# Frame, in projected pixels of geoAlbersUsa().scale(K).translate([CX, CY]). Keep in step with GEO_EXTENT in engine.ts.
K, CX, CY = 1300.0, 487.5, 305.0
X0, Y0, X1, Y1 = -600.0, -450.0, 1600.0, 1050.0
EPS = 1e-6


class Conic:
    """d3.geoConicEqualArea with rotate([-lon0, 0]), center, parallels, scale and translate (spherical)."""

    def __init__(self, rot: float, center: tuple[float, float], parallels: tuple[float, float], k: float, t: tuple[float, float]):
        p0, p1 = map(math.radians, parallels)
        self.n = (math.sin(p0) + math.sin(p1)) / 2
        self.c = 1 + math.sin(p0) * (2 * self.n - math.sin(p0))
        self.r0 = math.sqrt(self.c) / self.n
        self.rot, self.k, self.t = rot, k, t
        cx, cy = self._raw(np.radians(center[0]), np.radians(center[1]))
        self.off = (float(cx), float(cy))

    def _raw(self, lam, phi):
        r = np.sqrt(np.maximum(self.c - 2 * self.n * np.sin(phi), 0)) / self.n
        return r * np.sin(lam * self.n), self.r0 - r * np.cos(lam * self.n)

    def forward(self, lon, lat):
        lam = np.radians(((np.asarray(lon) + self.rot + 180) % 360) - 180)
        x, y = self._raw(lam, np.radians(lat))
        return self.t[0] + self.k * (x - self.off[0]), self.t[1] - self.k * (y - self.off[1])

    def inverse(self, px, py):
        x = (px - self.t[0]) / self.k + self.off[0]
        y = -(py - self.t[1]) / self.k + self.off[1]
        r0y = self.r0 - y
        lam = np.arctan2(x, np.abs(r0y)) * np.sign(r0y)
        lam = np.where(r0y * self.n < 0, lam - np.pi * np.sign(x) * np.sign(r0y), lam)
        phi = np.arcsin(np.clip((self.c - (x * x + r0y * r0y) * self.n * self.n) / (2 * self.n), -1, 1))
        return np.degrees(lam / self.n) - self.rot, np.degrees(phi)


LOWER48 = Conic(96, (-0.6, 38.7), (29.5, 45.5), K, (CX, CY))
ALASKA = Conic(154, (-2, 58.5), (55, 65), K * 0.35, (CX - 0.307 * K, CY + 0.201 * K))
HAWAII = Conic(157, (-3, 19.9), (8, 18), K, (CX - 0.205 * K, CY + 0.212 * K))
# Inset boxes (d3's clip extents), in projected pixels.
AK_BOX = (CX - 0.425 * K, CY + 0.120 * K, CX - 0.214 * K, CY + 0.234 * K)
HI_BOX = (CX - 0.214 * K, CY + 0.166 * K, CX - 0.115 * K, CY + 0.234 * K)


def fetch(url: str, cache: Path) -> bytes:
    p = cache / url.split("://", 1)[1].replace("/", "_")
    if not p.exists():
        with urllib.request.urlopen(url, timeout=60) as r:
            p.write_bytes(r.read())
    return p.read_bytes()


def topo_polygons(path: Path, obj: str) -> list[list[np.ndarray]]:
    topo = json.loads(path.read_text())
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for a in topo["arcs"]:
        q = np.cumsum(np.array(a, dtype=float), axis=0)
        arcs.append(np.c_[q[:, 0] * sx + tx, q[:, 1] * sy + ty])

    def ring(ix):
        pts = []
        for i in ix:
            a = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.append(a if not pts else a[1:])
        return np.vstack(pts)

    polys = []
    for g in topo["objects"][obj]["geometries"]:
        rings = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
        for p in rings:
            polys.append([ring(r) for r in p])
    return polys


def geojson_polygons(data: bytes) -> list[list[np.ndarray]]:
    polys = []
    for f in json.loads(data)["features"]:
        g = f["geometry"]
        for p in [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]:
            polys.append([np.array(r, dtype=float) for r in p])
    return polys


def western(polys):
    """Polygons wholly in the western hemisphere (skips Eurasia and Africa, which would wrap under the conics)."""
    return [p for p in polys if p[0][:, 0].max() < 0 or p[0][:, 0].min() > 150]


def rasterise(polys, proj: Conic, w: int, h: int, fill_holes: bool = True) -> np.ndarray:
    img = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img)
    sx, sy = w / (X1 - X0), h / (Y1 - Y0)
    for p in polys:
        for j, r in enumerate(p):
            lon = np.where(r[:, 0] > 150, r[:, 0] - 360, r[:, 0])
            x, y = proj.forward(lon, r[:, 1])
            pts = list(zip(((x - X0) * sx).tolist(), ((y - Y0) * sy).tolist()))
            if len(pts) >= 3:
                d.polygon(pts, fill=255 if j == 0 or not fill_holes else 0)
    return np.asarray(img, dtype=np.uint8)


def regions(w: int, h: int):
    """Projected pixel centres for a w x h raster and the region masks (Alaska box, Hawaii box)."""
    px = X0 + (np.arange(w) + 0.5) * (X1 - X0) / w
    py = Y0 + (np.arange(h) + 0.5) * (Y1 - Y0) / h
    gx, gy = np.meshgrid(px, py)
    ak = (gx > AK_BOX[0]) & (gx < AK_BOX[2]) & (gy > AK_BOX[1]) & (gy < AK_BOX[3])
    hi = (gx > HI_BOX[0]) & (gx < HI_BOX[2]) & (gy > HI_BOX[1]) & (gy < HI_BOX[3])
    return gx, gy, ak, hi


def composite(layers: dict[str, np.ndarray], ak, hi) -> np.ndarray:
    out = layers["l48"].copy()
    out[ak] = layers["ak"][ak]
    out[hi] = layers["hi"][hi]
    return out


def land_layers(w: int, h: int, cache: Path):
    ne_land = western(geojson_polygons(fetch(NE.format("ne_50m_land"), cache)))
    ne_lakes = western(geojson_polygons(fetch(NE.format("ne_50m_lakes"), cache)))
    us = topo_polygons(US_ATLAS, "nation")
    _, _, ak, hi = regions(w, h)
    land, usl, lake = {}, {}, {}
    for key, proj in (("l48", LOWER48), ("ak", ALASKA), ("hi", HAWAII)):
        u = rasterise(us, proj, w, h)
        lk = rasterise(ne_lakes, proj, w, h, fill_holes=False)
        n = rasterise(ne_land, proj, w, h)
        # Order: Natural Earth land, minus its lakes, then US land on top so the coast matches the state shapes.
        land[key] = np.maximum(np.where(lk > 0, 0, n), u)
        # The US channel marks only the land drawn as states in this region: in the main frame that is the lower 48
        # (Alaska, Hawaii and Puerto Rico at their true positions stay plain land); in an inset, all US land.
        usl[key] = rasterise([p for p in us if p[0][:, 1].max() < 50 and p[0][:, 0].min() > -126 and p[0][:, 0].max() < -66], proj, w, h) if key == "l48" else u
        lake[key] = np.where(u > 0, 0, lk)
    return composite(land, ak, hi), composite(usl, ak, hi), composite(lake, ak, hi)


def elevation(w: int, h: int, cache: Path) -> tuple[np.ndarray, np.ndarray]:
    """Elevation (m) at each pixel centre, and metres per pixel per region."""
    gx, gy, ak, hi = regions(w, h)
    lon, lat = LOWER48.inverse(gx, gy)
    for m, proj in ((ak, ALASKA), (hi, HAWAII)):
        lo, la = proj.inverse(gx[m], gy[m])
        lon[m], lat[m] = lo, la
    lon = ((lon + 180) % 360) - 180
    lat = np.clip(lat, -85, 85)
    n = 2**ZOOM
    tx = (lon + 180) / 360 * n * 256
    ty = (1 - np.log(np.tan(np.radians(lat)) + 1 / np.cos(np.radians(lat))) / np.pi) / 2 * n * 256
    need = {(int(x) // 256 % n, int(y) // 256) for x, y in zip(tx.ravel()[::7], ty.ravel()[::7])}
    need |= {((int(x) // 256 + dx) % n, int(y) // 256 + dy) for x, y in zip(tx.ravel()[::97], ty.ravel()[::97]) for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
    ys = sorted({y for _, y in need if 0 <= y < n})
    big = np.zeros((n * 256, n * 256), dtype=np.float32)
    for x, y in sorted(need):
        if not 0 <= y < n:
            continue
        a = np.asarray(Image.open(io.BytesIO(fetch(TILES.format(z=ZOOM, x=x, y=y), cache))).convert("RGB"), dtype=np.float32)
        big[y * 256 : (y + 1) * 256, x * 256 : (x + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    del ys
    # Bilinear sample.
    fx, fy = tx - 0.5, ty - 0.5
    x0 = np.floor(fx).astype(int)
    y0 = np.floor(fy).astype(int)
    ax, ay = fx - x0, fy - y0
    W = n * 256

    def at(xx, yy):
        return big[np.clip(yy, 0, W - 1), xx % W]

    e = (at(x0, y0) * (1 - ax) * (1 - ay) + at(x0 + 1, y0) * ax * (1 - ay) + at(x0, y0 + 1) * (1 - ax) * ay + at(x0 + 1, y0 + 1) * ax * ay)
    m_per_px = np.full((h, w), 6371000.0 / K * (X1 - X0) / w, dtype=np.float32)
    m_per_px[ak] /= 0.35
    return e.astype(np.float32), m_per_px


def hillshade(e: np.ndarray, mpp: np.ndarray, land: np.ndarray) -> np.ndarray:
    # Exaggerate land 6x and the sea floor 2x: at about 5 km a pixel, true relief is nearly invisible.
    z = np.where(land > 127, np.maximum(e, 0) * 6.0, np.minimum(e, 0) * 2.0)
    gy, gx = np.gradient(z)
    gx, gy = gx / mpp, gy / mpp
    az, alt = math.radians(315), math.radians(45)
    # Image y runs south; light from the northwest.
    lx, ly, lz = math.cos(alt) * math.sin(az), math.cos(alt) * math.cos(az), math.sin(alt)
    nx, ny, nz = -gx, gy, np.ones_like(gx)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    s = (nx * lx + ny * ly + nz * lz) / norm
    return np.clip(128 + (s - lz) / (1 - lz) * 160, 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", type=Path, default=ROOT / ".cache" / "geo")
    args = ap.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    w4, h4 = 4096, round(4096 * (Y1 - Y0) / (X1 - X0))
    land, usl, lake = land_layers(w4, h4, args.cache)

    w2, h2 = 2048, round(2048 * (Y1 - Y0) / (X1 - X0))
    e2, mpp2 = elevation(w2, h2, args.cache)
    e4 = np.asarray(Image.fromarray(e2).resize((w4, h4), Image.BILINEAR))
    _, _, ak4, _ = regions(w4, h4)
    land = np.where(ak4 & (e4 > 0) & (lake == 0), 255, land).astype(np.uint8)

    land2 = np.asarray(Image.fromarray(land).resize((w2, h2), Image.BILINEAR))
    shade = hillshade(e2, mpp2, land2)
    Image.fromarray(shade).filter(ImageFilter.GaussianBlur(0.6)).save(OUT / "relief-2048.webp", quality=72, method=6)

    w1, h1 = 1024, round(1024 * (Y1 - Y0) / (X1 - X0))
    land1 = np.asarray(Image.fromarray(land).resize((w1, h1), Image.BILINEAR))
    lake1 = np.asarray(Image.fromarray(lake).resize((w1, h1), Image.BILINEAR))
    e1 = np.asarray(Image.fromarray(e2).resize((w1, h1), Image.BILINEAR))
    depth = np.sqrt(np.clip(-e1, 0, 6000) / 6000)
    depth = np.where((land1 > 127) | (lake1 > 127), 0, depth)
    Image.fromarray((depth * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)).save(OUT / "depth-1024.webp", quality=80, method=6)

    rgb = np.dstack([land, usl, lake])
    Image.fromarray(rgb).save(OUT / "mask-4096.png", optimize=True)
    small = np.asarray(Image.fromarray(rgb).resize((2048, h2), Image.BILINEAR))
    Image.fromarray((np.round(small / 51.0) * 51).astype(np.uint8)).save(OUT / "mask-2048.png", optimize=True)
    for f in sorted(OUT.iterdir()):
        print(f"{f.name}: {f.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
