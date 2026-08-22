#!/usr/bin/env python3
"""Generate platform-specific runtime icons for all selectable app logos.

The source images remain untouched for the settings preview. Runtime assets use
transparent, antialiased rounded corners so a raw Electron Dock/taskbar icon
does not render as an opaque square. Windows gets a multi-size ICO so the shell
can pick a pixel-appropriate frame at each scale factor.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


LOGO_NAMES = ("A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4")
WINDOWS_ICON_SIZES = (16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 128, 256)
CANVAS_SIZE = 1024
CORNER_RADIUS_RATIO = 0.225
ANTIALIAS_SCALE = 4


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


def prepare_runtime_image(source_path: Path) -> Image.Image:
    source = Image.open(source_path).convert("RGBA")
    if source.width != source.height:
        edge = min(source.size)
        left = (source.width - edge) // 2
        top = (source.height - edge) // 2
        source = source.crop((left, top, left + edge, top + edge))
    source = source.resize((CANVAS_SIZE, CANVAS_SIZE), Image.Resampling.LANCZOS)
    source.putalpha(rounded_alpha_mask(CANVAS_SIZE))
    return source


def generate(source_dir: Path, output_dir: Path) -> None:
    macos_dir = output_dir / "macos"
    windows_dir = output_dir / "windows"
    macos_dir.mkdir(parents=True, exist_ok=True)
    windows_dir.mkdir(parents=True, exist_ok=True)

    for name in LOGO_NAMES:
        source_path = source_dir / f"{name}.png"
        if not source_path.is_file():
            raise FileNotFoundError(f"Missing source logo: {source_path}")

        runtime_image = prepare_runtime_image(source_path)
        runtime_image.save(macos_dir / f"{name}.png", format="PNG", optimize=True)
        runtime_image.save(
            windows_dir / f"{name}.ico",
            format="ICO",
            sizes=[(size, size) for size in WINDOWS_ICON_SIZES],
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "resources" / "logos",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "resources" / "logos",
    )
    args = parser.parse_args()
    generate(args.source_dir, args.output_dir)


if __name__ == "__main__":
    main()
