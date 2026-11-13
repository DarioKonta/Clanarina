"""Generates the app icon, adaptive icon layers, splash and favicon into assets/.

Glyph: a calendar with a check mark ("paid until"), sport-neutral.
Run: python scripts/make_icons.py   (needs Pillow)
"""

from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "assets"
TOP = (229, 57, 53)  # #E53935
BOTTOM = (183, 28, 28)  # #B71C1C
WHITE = (255, 255, 255, 255)
SS = 4  # supersampling factor


def glyph(size: int, color=WHITE) -> Image.Image:
    """Calendar + check on a transparent square of `size` px (glyph fills the square)."""
    s = size * SS
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = s / 100  # work in a 100x100 grid

    def box(x0, y0, x1, y1):
        return [x0 * u, y0 * u, x1 * u, y1 * u]

    # Body outline and header bar.
    d.rounded_rectangle(box(8, 16, 92, 94), radius=12 * u, outline=color, width=round(8 * u))
    d.rounded_rectangle(box(8, 16, 92, 38), radius=12 * u, fill=color)
    d.rectangle(box(8, 28, 92, 38), fill=color)
    # Binder rings.
    for x in (30, 70):
        d.rounded_rectangle(box(x - 5, 4, x + 5, 26), radius=5 * u, fill=color)
    # Check mark.
    w = round(10 * u)
    pts = [(30 * u, 65 * u), (44 * u, 79 * u), (71 * u, 51 * u)]
    d.line(pts, fill=color, width=w, joint="curve")
    r = w / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - r, y - r, x + r, y + r], fill=color)
    return im.resize((size, size), Image.LANCZOS)


def gradient(size: int) -> Image.Image:
    im = Image.new("RGBA", (size, size))
    px = im.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)) + (255,)
    return im


def centered(canvas: int, glyph_size: int, bg=None) -> Image.Image:
    im = bg.copy() if bg is not None else Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    g = glyph(glyph_size)
    off = (canvas - glyph_size) // 2
    im.alpha_composite(g, (off, off))
    return im


def main() -> None:
    # Legacy/iOS icon: full-bleed gradient, glyph ~50%.
    centered(1024, 520, gradient(1024)).convert("RGB").save(ASSETS / "icon.png")
    # Adaptive icon: glyph must sit inside the 66% safe zone of the 108dp canvas.
    centered(512, 250).save(ASSETS / "android-icon-foreground.png")
    gradient(512).save(ASSETS / "android-icon-background.png")
    centered(432, 210).save(ASSETS / "android-icon-monochrome.png")
    # Splash: white glyph on transparent (background color comes from app.json).
    centered(1024, 900).save(ASSETS / "splash-icon.png")
    centered(48, 34, gradient(48)).save(ASSETS / "favicon.png")
    print("Icons written to", ASSETS)


if __name__ == "__main__":
    main()
