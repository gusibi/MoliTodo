#!/usr/bin/env python3
"""Generate platform-specific runtime icons and settings previews for app logos.

The source images in resources/logos remain untouched and are only used to derive:

- resources/logos/macos: inset, antialiased rounded-square Dock icons
- resources/logos/windows: multi-size ICO so the shell can pick an exact match
- src/renderer/public/logos: small PNG previews for the settings logo picker
- src/renderer/public/icon.png: small icon used in the title bar

Keeping the full-resolution sources out of the shipped renderer assets saves
about 13 MB per build.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


LOGO_NAMES = ("A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4")
# C-series sources are square canvases that already carry their final shape
# (rounded card corners or an irregular cut-out silhouette), so they only need
# scaling onto the platform canvases and must not be re-masked.
SHAPED_LOGO_NAMES = ("C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11")
WINDOWS_ICON_SIZES = (16, 20, 24, 32, 40, 48, 64, 96, 128, 256)
CANVAS_SIZE = 1024
MACOS_FOOTPRINT_SIZE = 824
CORNER_RADIUS_RATIO = 0.225
ANTIALIAS_SCALE = 4
# 设置页预览最大 48px，256px 足够覆盖 2x/3x 屏幕，同时远小于 1024px 原图
PREVIEW_SIZE = 256
TITLEBAR_ICON_SIZE = 128


def rounded_alpha_mask(size: int) -> Image.Image:
    """Return an antialiased macOS/Windows rounded-corner alpha mask."""

    high_size = size * ANTIALIAS_SCALE
    high_radius = round(size * CORNER_RADIUS_RATIO * ANTIALIAS_SCALE)
    mask = Image.new("L", (high_size, high_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, high_size - 1, high_size - 1),
        radius=high_radius,
        fill=255,
    )
    return mask.resize((size, size), Image.Resampling.LANCZOS)


def prepare_source_image(source_path: Path) -> Image.Image:
    source = Image.open(source_path).convert("RGBA")
    if source.width != source.height:
        raise ValueError(f"Source logo must be square: {source_path} is {source.size}")
    return source


def prepare_macos_image(source: Image.Image) -> Image.Image:
    footprint = source.resize(
        (MACOS_FOOTPRINT_SIZE, MACOS_FOOTPRINT_SIZE),
        Image.Resampling.LANCZOS,
    )
    footprint.putalpha(rounded_alpha_mask(MACOS_FOOTPRINT_SIZE))
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    offset = (CANVAS_SIZE - MACOS_FOOTPRINT_SIZE) // 2
    canvas.alpha_composite(footprint, (offset, offset))
    return canvas


def prepare_macos_image_shaped(source: Image.Image) -> Image.Image:
    footprint = source.resize(
        (MACOS_FOOTPRINT_SIZE, MACOS_FOOTPRINT_SIZE),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    offset = (CANVAS_SIZE - MACOS_FOOTPRINT_SIZE) // 2
    canvas.alpha_composite(footprint, (offset, offset))
    return canvas


def prepare_windows_image(source: Image.Image) -> Image.Image:
    return source.resize((CANVAS_SIZE, CANVAS_SIZE), Image.Resampling.LANCZOS)


def generate(source_dir: Path, output_dir: Path) -> None:
    macos_dir = output_dir / "macos"
    windows_dir = output_dir / "windows"
    macos_dir.mkdir(parents=True, exist_ok=True)
    windows_dir.mkdir(parents=True, exist_ok=True)

    for name in LOGO_NAMES:
        source_path = source_dir / f"{name}.png"
        if not source_path.is_file():
            raise FileNotFoundError(f"Missing source logo: {source_path}")

        source = prepare_source_image(source_path)
        prepare_macos_image(source).save(
            macos_dir / f"{name}.png",
            format="PNG",
            optimize=True,
        )
        prepare_windows_image(source).save(
            windows_dir / f"{name}.ico",
            format="ICO",
            sizes=[(size, size) for size in WINDOWS_ICON_SIZES],
        )

    for name in SHAPED_LOGO_NAMES:
        source_path = source_dir / f"{name}.png"
        if not source_path.is_file():
            raise FileNotFoundError(f"Missing source logo: {source_path}")

        source = prepare_source_image(source_path)
        prepare_macos_image_shaped(source).save(
            macos_dir / f"{name}.png",
            format="PNG",
            optimize=True,
        )
        prepare_windows_image(source).save(
            windows_dir / f"{name}.ico",
            format="ICO",
            sizes=[(size, size) for size in WINDOWS_ICON_SIZES],
        )


def generate_previews(source_dir: Path, preview_dir: Path, titlebar_icon_path: Path) -> None:
    preview_dir.mkdir(parents=True, exist_ok=True)

    for name in (*LOGO_NAMES, *SHAPED_LOGO_NAMES):
        source_path = source_dir / f"{name}.png"
        if not source_path.is_file():
            raise FileNotFoundError(f"Missing source logo: {source_path}")

        prepare_source_image(source_path).resize(
            (PREVIEW_SIZE, PREVIEW_SIZE),
            Image.Resampling.LANCZOS,
        ).save(
            preview_dir / f"{name}.png",
            format="PNG",
            optimize=True,
        )

    icon_source = source_dir.parent / "icon.png"
    if icon_source.is_file():
        titlebar_icon_path.parent.mkdir(parents=True, exist_ok=True)
        prepare_source_image(icon_source).resize(
            (TITLEBAR_ICON_SIZE, TITLEBAR_ICON_SIZE),
            Image.Resampling.LANCZOS,
        ).save(
            titlebar_icon_path,
            format="PNG",
            optimize=True,
        )


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=project_root / "resources" / "logos",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=project_root / "resources" / "logos",
    )
    parser.add_argument(
        "--preview-dir",
        type=Path,
        default=project_root / "src" / "renderer" / "public" / "logos",
    )
    parser.add_argument(
        "--preview-icon",
        type=Path,
        default=project_root / "src" / "renderer" / "public" / "icon.png",
    )
    parser.add_argument(
        "--skip-previews",
        action="store_true",
        help="Only regenerate platform runtime icons",
    )
    args = parser.parse_args()
    generate(args.source_dir, args.output_dir)
    if not args.skip_previews:
        generate_previews(args.source_dir, args.preview_dir, args.preview_icon)


if __name__ == "__main__":
    main()
