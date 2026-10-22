"""Genera los recursos de marca de Starfutbol a partir del logotipo original.

Uso (desde la carpeta del proyecto):
    python scripts/brand-assets.py

Entrada:  ../logo.webp  (logotipo original, 400x174, fondo transparente)
Salidas:
    public/brand/logo-original.webp  copia del original
    public/brand/logo.png            colores originales, ampliado 3x
    public/brand/logo-blanco.png     versión monocromática blanca (balón con estrellas rojas)
    src/pdf/assets/bg-portrait.jpg   fondo para PDF carta vertical (150 dpi)
    src/pdf/assets/bg-landscape.jpg  fondo para PDF carta horizontal (150 dpi)

Los fondos son una composición original (degradados, textura, destellos y la
silueta del jugador del logotipo); NO reproducen la fotografía de las imágenes
de referencia.
"""

from __future__ import annotations

import math
import random
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC_LOGO = ROOT.parent / "logo.webp"
OUT_BRAND = ROOT / "public" / "brand"
OUT_ASSETS = ROOT / "src" / "pdf" / "assets"
SCALE = 3


def load_logo() -> np.ndarray:
    return np.asarray(Image.open(SRC_LOGO).convert("RGBA")).astype(np.float32)


def smooth_upscale_mask(mask: np.ndarray, scale: int, blur: float = 0.75) -> Image.Image:
    """Amplía una máscara (0..255) con bordes suaves y nítidos (sin escalones)."""
    img = Image.fromarray(np.clip(mask, 0, 255).astype(np.uint8), "L")
    big = img.resize((img.width * scale, img.height * scale), Image.BICUBIC)
    big = big.filter(ImageFilter.GaussianBlur(scale * blur))
    # Curva de contraste centrada en 50 %: bordes definidos pero antialiasados.
    lut = [int(max(0, min(255, (v - 95) * 255 / (165 - 95)))) for v in range(256)]
    return big.point(lut)


def build_white_logo(rgba: np.ndarray) -> Image.Image:
    """Versión blanca como en las referencias: sin el contorno blanco exterior,
    letras y jugador en blanco, balón blanco con sus estrellas rojas."""
    h, w = rgba.shape[:2]
    r, g, b, a = (rgba[..., i] for i in range(4))
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    opaque = a >= 110
    whiteish = (lum > 175) & ((mx - mn) < 85)
    red = opaque & (r > 165) & (g < 110) & (b < 120) & (r - g > 90)

    # Balón: círculo estimado a partir de las estrellas rojas y del borde superior opaco.
    ys, xs = np.nonzero(red)
    cx = (xs.min() + xs.max()) / 2
    radius = (xs.max() - xs.min()) / 2 + 2.0
    col = opaque[:, int(round(cx))]
    top = int(np.argmax(col))
    cy = top + radius + 1.0
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)

    # Contorno blanco exterior, contraformas de las letras y cualquier blanco fuera
    # del balón → transparente (equivale al relleno por inundación desde lo
    # transparente a través de píxeles casi blancos, sin cerrar las letras).
    colored = opaque & ~whiteish
    soft = np.where(colored, np.minimum(a, 255.0), 0.0)
    # Separación fina alrededor del balón para que se lea como pieza aparte.
    gap = (dist > radius) & (dist < radius + 1.6)
    soft = np.where(gap, 0.0, soft)
    disc = np.clip((radius - dist) * 255.0 + 128, 0, 255)
    soft = np.maximum(soft, disc)
    alpha_img = smooth_upscale_mask(soft, SCALE)

    # Color: blanco salvo las estrellas rojas del balón.
    red_soft = np.where(dist <= radius + 0.5, red * 255.0, 0)
    red_mask = smooth_upscale_mask(red_soft, SCALE, 0.5)
    white = Image.new("RGB", (w * SCALE, h * SCALE), (255, 255, 255))
    star_red = Image.new("RGB", (w * SCALE, h * SCALE), (226, 27, 38))
    rgb = Image.composite(star_red, white, red_mask)
    out = rgb.convert("RGBA")
    out.putalpha(alpha_img)
    return out.crop(out.getbbox())


def build_color_logo() -> Image.Image:
    img = Image.open(SRC_LOGO).convert("RGBA")
    big = img.resize((img.width * SCALE, img.height * SCALE), Image.LANCZOS)
    return big.crop(big.getbbox())


def player_mask(rgba: np.ndarray) -> Image.Image:
    """Píxeles naranjas del logotipo = silueta del jugador."""
    r, g, b, a = (rgba[..., i] for i in range(4))
    orange = (a > 100) & (r > 180) & (g > 90) & (g < 200) & (b < 120) & (r - b > 110)
    m = Image.fromarray((orange * 255).astype(np.uint8), "L")
    m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    return m.crop(m.getbbox())


def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def build_background(size: tuple[int, int], silhouette: Image.Image, seed: int, landscape: bool) -> Image.Image:
    W, H = size
    rnd = random.Random(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    nx, ny = xx / W, yy / H
    aspect = W / H

    # Degradado diagonal rojo intenso → negro.
    t = np.clip(nx * 0.30 + ny * 0.80, 0, 1.2)
    deep = np.array([14, 1, 3], np.float32)
    mid = np.array([132, 10, 14], np.float32)
    hot = np.array([232, 34, 30], np.float32)
    base = deep + (mid - deep) * np.clip(1.10 - t, 0, 1)[..., None] ** 0.8

    def glow(cx, cy, rad, strength):
        d = np.sqrt(((nx - cx) * aspect) ** 2 + (ny - cy) ** 2) if landscape else np.sqrt((nx - cx) ** 2 + ((ny - cy) / aspect) ** 2)
        return np.clip(1 - d / rad, 0, 1) ** 2 * strength

    g = glow(0.80, 0.10, 0.70, 1.0) + glow(0.30, 0.42, 0.60, 0.55) + glow(0.05, 0.0, 0.40, 0.45) + glow(0.95, 0.75, 0.45, 0.25)
    base = base + (hot - base) * np.clip(g, 0, 1)[..., None]
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB")

    # Silueta gigante y desenfocada del jugador (sustituto original de la foto deportiva).
    sil = silhouette
    target_w = int(W * (1.30 if not landscape else 0.92))
    sil = sil.resize((target_w, int(sil.height * target_w / sil.width)), Image.LANCZOS)
    sil = sil.rotate(-12 if not landscape else -6, resample=Image.BICUBIC, expand=True)
    layer = Image.new("L", (W, H), 0)
    ox = int(W * (-0.04 if not landscape else 0.12))
    oy = int(H * (0.26 if not landscape else 0.16))
    layer.paste(sil, (ox, oy))
    lf = np.asarray(layer.filter(ImageFilter.GaussianBlur(W / 110))).astype(np.float32) / 255
    # Cuerpo iluminado desde arriba a la derecha (rojo anaranjado) con sombra abajo a la izquierda.
    light = np.clip(0.35 + (nx - 0.2) * 0.5 + (0.6 - ny) * 0.6, 0.15, 1.0)
    body_lit = np.array([255, 70, 50], np.float32)
    body_dark = np.array([60, 4, 8], np.float32)
    body_col = body_dark + (body_lit - body_dark) * light[..., None]
    arr = np.asarray(img).astype(np.float32)
    arr = arr + (body_col - arr) * (lf * 0.42)[..., None]
    # Luz de contorno suave (contraluz).
    rim = np.asarray(
        ImageChops.subtract(layer.filter(ImageFilter.GaussianBlur(W / 200)), layer.filter(ImageFilter.MinFilter(13)).filter(ImageFilter.GaussianBlur(W / 200)))
        .filter(ImageFilter.GaussianBlur(W / 260))
    ).astype(np.float32) / 255
    arr = arr + (np.array([255, 150, 120], np.float32) - arr) * (rim * 0.22 * light)[..., None]
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")

    # Destellos diagonales.
    streaks = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(streaks)
    for _ in range(30):
        x0 = rnd.uniform(-0.3, 1.1) * W
        y0 = rnd.uniform(-0.1, 1.0) * H
        length = rnd.uniform(0.25, 0.8) * W
        ang = math.radians(rnd.uniform(-36, -24))
        x1, y1 = x0 + length * math.cos(ang), y0 + length * math.sin(ang)
        width = rnd.choice([1, 2, 2, 3, 6, 14, 30])
        d.line((x0, y0, x1, y1), fill=rnd.randint(50, 130) if width < 6 else rnd.randint(14, 34), width=width)
    streaks = streaks.filter(ImageFilter.GaussianBlur(4))
    img = Image.composite(Image.new("RGB", (W, H), (255, 130, 95)), img, streaks.point(lambda v: int(v * 0.6)))

    # Bokeh y chispas.
    sparks = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(sparks)
    for _ in range(26):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H * 0.7)
        r = rnd.uniform(W / 90, W / 28)
        d.ellipse((x - r, y - r, x + r, y + r), fill=rnd.randint(10, 30))
    for _ in range(240):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        r = rnd.choice([1, 1, 1, 2, 2, 3])
        d.ellipse((x - r, y - r, x + r, y + r), fill=rnd.randint(60, 200))
    sparks = sparks.filter(ImageFilter.GaussianBlur(1.6))
    img = Image.composite(Image.new("RGB", (W, H), (255, 190, 150)), img, sparks.point(lambda v: int(v * 0.6)))

    # Textura deportiva: tramado diagonal tenue + grano.
    hatch = ((xx + yy) % 9 < 1.2).astype(np.float32) * 10
    noise = np.random.default_rng(seed).normal(0, 7.0, (H, W)).astype(np.float32)
    arr = np.asarray(img).astype(np.float32)
    arr = arr - hatch[..., None] * 0.6 + noise[..., None]

    # Viñeta: bordes y parte baja más oscuros (legibilidad de las tablas).
    vign = np.clip(1 - (((nx - 0.55) * 1.4) ** 2 + ((ny - 0.35) * 1.2) ** 2) * 0.55, 0.42, 1)
    arr = arr * vign[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def save_jpeg(img: Image.Image, path: Path, limit_kb: int = 600):
    for q in (85, 80, 75, 70, 65):
        img.save(path, "JPEG", quality=q, optimize=True, progressive=True, dpi=(150, 150))
        if path.stat().st_size <= limit_kb * 1024:
            break
    print(f"{path.relative_to(ROOT)}: {img.size} {path.stat().st_size // 1024} KB (q={q})")


def main():
    OUT_BRAND.mkdir(parents=True, exist_ok=True)
    OUT_ASSETS.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SRC_LOGO, OUT_BRAND / "logo-original.webp")
    rgba = load_logo()

    color = build_color_logo()
    color.save(OUT_BRAND / "logo.png", optimize=True)
    white = build_white_logo(rgba)
    white.save(OUT_BRAND / "logo-blanco.png", optimize=True)
    print("logo.png", color.size, "logo-blanco.png", white.size)

    sil = player_mask(rgba)
    save_jpeg(build_background((1275, 1650), sil, 7, False), OUT_ASSETS / "bg-portrait.jpg")
    save_jpeg(build_background((1650, 1275), sil, 11, True), OUT_ASSETS / "bg-landscape.jpg")


if __name__ == "__main__":
    main()
