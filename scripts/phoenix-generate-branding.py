#!/usr/bin/env python3
"""Gera assets Phoenix a partir da logomarca fonte (PNG com transparência)."""
from pathlib import Path
from typing import Optional, Tuple

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "branding/source/phoenix_digital_agents_omnichannel.png"
LOGIN_SOURCE = ROOT / "branding/source/phoenix_login_full.png"
OUT = ROOT / "branding"
CW_PUBLIC = ROOT / "chatwoot/public"
CW_BRAND = CW_PUBLIC / "brand-assets"


def trim_transparent(img: Image.Image) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def fit_within(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    img = trim_transparent(img)
    ratio = min(max_w / img.width, max_h / img.height, 1.0)
    size = (max(1, int(img.width * ratio)), max(1, int(img.height * ratio)))
    return img.resize(size, Image.Resampling.LANCZOS)


def save_png(img: Image.Image, path: Path, size: Optional[Tuple[int, int]] = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = img
    if size:
        out = fit_within(img, size[0], size[1])
    if out.mode != "RGBA":
        out = out.convert("RGBA")
    out.save(path, format="PNG", optimize=True)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Fonte não encontrada: {SOURCE}")

    base = Image.open(SOURCE).convert("RGBA")
    base = trim_transparent(base)

    # Repositório branding/
    save_png(base, OUT / "logos/phoenix-logo-full.png", (1200, 400))
    save_png(base, OUT / "logos/phoenix-logo-login.png", (480, 160))
    save_png(base, OUT / "logos/phoenix-logo-sidebar.png", (200, 200))
    save_png(base, OUT / "logos/phoenix-logo-header.png", (320, 96))
    save_png(base, OUT / "logos/phoenix-logo-thumbnail.png", (512, 512))
    save_png(base, OUT / "logos/phoenix-logo-dark.png", (1200, 400))

    for size in (16, 32, 96, 512):
        save_png(base, OUT / f"favicons/favicon-{size}x{size}.png", (size, size))

    save_png(base, OUT / "social-previews/og-image.png", (1200, 630))
    save_png(base, OUT / "email-assets/email-logo.png", (280, 80))

    # Chatwoot public (substituição visual)
    CW_BRAND.mkdir(parents=True, exist_ok=True)
    save_png(base, CW_BRAND / "logo.png", (1200, 400))
    save_png(base, CW_BRAND / "logo_dark.png", (1200, 400))
    save_png(base, CW_BRAND / "logo_thumbnail.png", (512, 512))

    if LOGIN_SOURCE.exists():
        login_img = Image.open(LOGIN_SOURCE).convert("RGBA")
        login_img.save(CW_BRAND / "logo_login.png", format="PNG", optimize=True)
    else:
        save_png(base, CW_BRAND / "logo_login.png", (960, 880))

    for size in (16, 32, 96, 512):
        save_png(base, CW_PUBLIC / f"favicon-{size}x{size}.png", (size, size))
        save_png(base, CW_PUBLIC / f"favicon-badge-{size}x{size}.png", (size, size))

    print("Branding Phoenix gerado com sucesso.")


if __name__ == "__main__":
    main()
