"""Generate a high-contrast MovPrompt brand poster for the New York Billboard
template preview. Output: docs/template-demos/references/v1/new-york-billboard-takeover.png
Size: 720x1280 (9:16 vertical) to match the approved Seedance 2.5 preview contract.
Designed for big-screen legibility: high contrast, bold hierarchy, premium feel.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path

OUT = Path("/Users/Projects/VirtuProse/Zaid-MOVPROMPT/docs/template-demos/references/v1/new-york-billboard-takeover.png")

NAVY_DEEP = (10, 14, 32)
NAVY_MID = (18, 24, 56)
AMBER = (242, 165, 43)
AMBER_GLOW = (255, 188, 92)
WHITE = (255, 255, 255)
GREY = (148, 156, 175)

W, H = 720, 1280
MARGIN = 40  # safe margin on all sides


def pick_bold(size):
    candidates = [
        "/System/Library/Fonts/Supplemental/Verdana Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        "/System/Library/Fonts/Supplemental/Impact.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
    return ImageFont.load_default()


def text_size(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def fit_font(draw, text, max_w, start_size, min_size=20, step=2):
    """Shrink font size until text fits within max_w."""
    size = start_size
    while size > min_size:
        font = pick_bold(size)
        w, _ = text_size(draw, text, font)
        if w <= max_w:
            return font
        size -= step
    return pick_bold(min_size)


def center_x(draw, text, font, canvas_w=W):
    w, _ = text_size(draw, text, font)
    return (canvas_w - w) / 2


# Base canvas
img = Image.new("RGB", (W, H), NAVY_DEEP)
draw = ImageDraw.Draw(img)

# Vertical gradient
for y in range(H):
    t = y / H
    r = int(NAVY_DEEP[0] * (1 - t) + NAVY_MID[0] * t)
    g = int(NAVY_DEEP[1] * (1 - t) + NAVY_MID[1] * t)
    b = int(NAVY_DEEP[2] * (1 - t) + NAVY_MID[2] * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# Amber glow
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
cx, cy, r0 = 540, 260, 320
for i in range(40, 0, -1):
    alpha = int(10 * (1 - i / 40))
    gd.ellipse(
        [cx - r0 - i * 4, cy - r0 - i * 4, cx + r0 + i * 4, cy + r0 + i * 4],
        fill=(AMBER_GLOW[0], AMBER_GLOW[1], AMBER_GLOW[2], alpha),
    )
glow = glow.filter(ImageFilter.GaussianBlur(radius=40))
img.paste(glow, (0, 0), glow)
draw = ImageDraw.Draw(img, "RGBA")

max_w = W - 2 * MARGIN

# Top eyebrow pill
eyebrow_font = pick_bold(32)
eyebrow = "ADVERTISEMENT"
ew, eh = text_size(draw, eyebrow, eyebrow_font)
ex, ey_ = center_x(draw, eyebrow, eyebrow_font), 140
pad_x, pad_y = 26, 12
draw.rounded_rectangle(
    [ex - pad_x, ey_ - pad_y, ex + ew + pad_x, ey_ + eh + pad_y],
    radius=22, fill=(255, 255, 255, 14), outline=AMBER, width=2,
)
draw.text((ex, ey_), eyebrow, font=eyebrow_font, fill=AMBER)

# Brand wordmark - auto-fit to width
brand = "MOVPROMPT"
brand_font = fit_font(draw, brand, max_w, start_size=130, min_size=70, step=4)
bw, bh = text_size(draw, brand, brand_font)
bx, by = center_x(draw, brand, brand_font), 250
draw.text((bx, by), brand, font=brand_font, fill=WHITE)

# Brand sub-tagline
tagline_font = pick_bold(26)
tagline = "AI VIDEO ADS  -  KUWAIT"
tagline_font = fit_font(draw, tagline, max_w, start_size=26)
tw, th = text_size(draw, tagline, tagline_font)
draw.text((center_x(draw, tagline, tagline_font), by + bh + 14), tagline, font=tagline_font, fill=AMBER)

# Hero headline
hero_text = "OWN THE"
hero_font = fit_font(draw, hero_text, max_w, start_size=92, min_size=48, step=2)
hw, hh = text_size(draw, hero_text, hero_font)
hy = 640
draw.text((center_x(draw, hero_text, hero_font), hy), hero_text, font=hero_font, fill=WHITE)

hero_text2 = "MOMENT"
hero2_font = fit_font(draw, hero_text2, max_w, start_size=92, min_size=48, step=2)
hw2, hh2 = text_size(draw, hero_text2, hero2_font)
draw.text((center_x(draw, hero_text2, hero2_font), hy + hh + 18), hero_text2, font=hero2_font, fill=WHITE)

# Divider
divider_y = hy + hh + hh2 + 70
draw.line([(W * 0.28, divider_y), (W * 0.72, divider_y)], fill=AMBER, width=3)

# CTA
cta = "CREATE YOUR CAMPAIGN"
cta_font = fit_font(draw, cta, max_w, start_size=46, min_size=24, step=2)
cw, ch = text_size(draw, cta, cta_font)
draw.text((center_x(draw, cta, cta_font), divider_y + 40), cta, font=cta_font, fill=WHITE)

# URL
url = "movprompt.com"
url_font = fit_font(draw, url, max_w, start_size=32, min_size=20, step=2)
uw, uh = text_size(draw, url, url_font)
draw.text((center_x(draw, url, url_font), divider_y + 40 + ch + 24), url, font=url_font, fill=AMBER)

# Demo-artwork tag at bottom
demo = "MOVPROMPT DEMO ARTWORK - NY BILLBOARD PREVIEW"
demo_font = fit_font(draw, demo, max_w, start_size=20, min_size=14, step=1)
dw_, dh_ = text_size(draw, demo, demo_font)
draw.text((center_x(draw, demo, demo_font), H - dh_ - 32), demo, font=demo_font, fill=GREY)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.convert("RGB").save(OUT, format="PNG", optimize=True)
print(f"Wrote: {OUT}  ({OUT.stat().st_size} bytes)  {W}x{H}")
