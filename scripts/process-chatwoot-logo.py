#!/usr/bin/env python3
"""Remove fundo escuro e gera logos PNG transparentes em tamanho maior."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND_DIR = ROOT / "chatwoot-brand"
THRESHOLD = 22
FEATHER = 24
BG_THRESHOLD = 55


def remove_dark_background(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            darkest = min(r, g, b)
            # Fundo preto sólido
            if r <= BG_THRESHOLD and g <= BG_THRESHOLD and b <= BG_THRESHOLD:
                px[x, y] = (0, 0, 0, 0)
                continue
            if darkest <= THRESHOLD:
                px[x, y] = (r, g, b, 0)
                continue
            if darkest < THRESHOLD + FEATHER:
                alpha = int(255 * (darkest - THRESHOLD) / FEATHER)
                px[x, y] = (r, g, b, min(255, max(alpha, a)))

    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)

    return rgba


def fit_max(img: Image.Image, max_side: int) -> Image.Image:
    w, h = img.size
    scale = max_side / max(w, h)
    if scale <= 1:
        return img
    return img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)


def pad_square(img: Image.Image, side: int) -> Image.Image:
    w, h = img.size
    if w == side and h == side:
        return img
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - w) // 2
    oy = (side - h) // 2
    canvas.paste(img, (ox, oy), img)
    return canvas


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else BRAND_DIR / "logo-source.jpg"
    if not src.exists():
        # fallback: último asset anexado ou logo.png existente
        for candidate in sorted((ROOT / ".cursor").glob("**/phoenix_digital_agents*.png"), reverse=True):
            src = candidate
            break
    if not src.exists():
        src = BRAND_DIR / "logo.png"
    if not src.exists():
        raise SystemExit(f"Arquivo de origem não encontrado: {src}")

    BRAND_DIR.mkdir(parents=True, exist_ok=True)
    cleaned = remove_dark_background(Image.open(src))
    main_logo = fit_max(cleaned, 2048)
    thumb = fit_max(cleaned, 512)

    main_logo.save(BRAND_DIR / "logo.png", "PNG", optimize=True)
    main_logo.save(BRAND_DIR / "logo_dark.png", "PNG", optimize=True)
    pad_square(thumb, 512).save(BRAND_DIR / "logo_thumbnail.png", "PNG", optimize=True)

    print(f"OK logo {main_logo.size[0]}x{main_logo.size[1]} transparente")
    print("OK thumb 512x512")


if __name__ == "__main__":
    main()
