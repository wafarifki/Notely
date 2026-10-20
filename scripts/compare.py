"""Pixel comparison helper: reports panel bounds, sidebar split and dominant colors."""

from __future__ import annotations

import sys
from PIL import Image


def frame_bounds(img: Image.Image) -> tuple[int, int, int, int]:
    width, height = img.size
    pixels = img.load()
    target = (246, 248, 252)
    ys = []
    xs = []
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y][:3]
            if abs(r - target[0]) <= 3 and abs(g - target[1]) <= 3 and abs(b - target[2]) <= 3:
                ys.append(y)
                xs.append(x)
    if not xs:
        return (0, 0, 0, 0)
    return (min(xs), min(ys), max(xs), max(ys))


def sidebar_split(img: Image.Image, top: int, bottom: int) -> int | None:
    pixels = img.load()
    width = img.size[0]
    for x in range(0, width):
        r, g, b = pixels[x, top + 20][:3]
        if abs(r - 222) <= 8 and abs(g - 226) <= 8 and abs(b - 235) <= 8:
            return x
    return None


def sample(img: Image.Image, points: dict[str, tuple[int, int]]) -> dict[str, tuple[int, int, int]]:
    pixels = img.load()
    return {name: pixels[x, y][:3] for name, (x, y) in points.items()}


def main() -> None:
    for path in sys.argv[1:]:
        img = Image.open(path).convert("RGB")
        left, top, right, bottom = frame_bounds(img)
        print(f"{path}: size={img.size} panel=({left},{top})-({right},{bottom}) size={right-left}x{bottom-top}")
        split = sidebar_split(img, top, bottom)
        print(f"  sidebar divider x={split} (sidebar width {split - left if split else 'n/a'})")
        points = {
            "canvas_tl": (5, 5),
            "canvas_tr": (img.size[0] - 6, 5),
            "canvas_bl": (5, img.size[1] - 6),
            "main_bg": (right - 40, top + 40),
            "sidebar_bg": (left + 40, bottom - 60),
        }
        for name, rgb in sample(img, points).items():
            print(f"  {name}: #{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}")


if __name__ == "__main__":
    main()
