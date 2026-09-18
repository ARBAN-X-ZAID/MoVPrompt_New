#!/usr/bin/env python3
"""Create deterministic, provider-free poster art for the public template catalog."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "template-demos" / "posters" / "v1"
SIZE = (1080, 1350)

TEMPLATES = [
    ("premium-phone-reveal", "MOBILE / ELECTRONICS", "Premium Phone Reveal", (18, 20, 27), (235, 167, 52), "phone"),
    ("phone-floating-ad", "MOBILE / ELECTRONICS", "Phone Floating Advertisement", (19, 28, 54), (73, 125, 255), "phone_float"),
    ("restaurant-food-hero", "FOOD / RESTAURANTS", "Restaurant Food Hero Shot", (37, 21, 18), (238, 118, 55), "dish"),
    ("food-delivery-ad", "FOOD / RESTAURANTS", "Food Delivery Advertisement", (42, 27, 18), (236, 151, 34), "delivery"),
    ("fashion-product-showcase", "CLOTHING / FASHION", "Fashion Product Showcase", (30, 31, 34), (216, 205, 184), "fashion"),
    ("luxury-fashion-reveal", "CLOTHING / FASHION", "Luxury Brand Product Reveal", (10, 10, 12), (213, 166, 82), "luxury"),
    ("cosmetic-product-commercial", "BEAUTY / COSMETICS", "Cosmetic Product Commercial", (72, 49, 55), (245, 183, 196), "cosmetic"),
    ("perfume-advertisement", "BEAUTY / COSMETICS", "Perfume Advertisement", (23, 20, 31), (178, 135, 223), "perfume"),
    ("real-estate-property", "REAL ESTATE / SERVICES", "Real Estate Property Advertisement", (28, 38, 43), (104, 180, 171), "property"),
    ("business-service-promotion", "REAL ESTATE / SERVICES", "Business / Service Promotional Video", (24, 31, 45), (88, 151, 224), "service"),
]

def font(size: int, bold: bool = False):
    candidates = [
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    path = next((item for item in candidates if item.exists()), None)
    return ImageFont.truetype(str(path), size) if path else ImageFont.load_default()

def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def subject(draw, kind, accent):
    white = (248, 248, 246)
    line = tuple(min(255, channel + 30) for channel in accent)
    if kind.startswith("phone"):
        box = (365, 215, 715, 875 if kind == "phone_float" else 900)
        rounded(draw, box, 58, (218, 220, 225), line, 5)
        rounded(draw, (390, 250, 690, 825), 40, (31, 34, 43), None)
        for x, y in [(435, 300), (525, 300), (435, 390)]: draw.ellipse((x-35, y-35, x+35, y+35), fill=(8, 10, 14), outline=accent, width=6)
        if kind == "phone_float":
            for x, y, r in [(250, 360, 12), (810, 490, 18), (280, 720, 8), (845, 760, 10)]: draw.ellipse((x-r, y-r, x+r, y+r), fill=accent)
    elif kind in ("dish", "delivery"):
        draw.ellipse((225, 380, 855, 880), fill=(235, 229, 213), outline=line, width=8)
        draw.ellipse((310, 455, 770, 810), fill=(104, 45, 30))
        for box, color in [((370, 510, 520, 650), (225, 146, 57)), ((520, 540, 670, 690), (96, 137, 63)), ((435, 650, 610, 760), (238, 190, 91))]: draw.ellipse(box, fill=color)
        if kind == "delivery": rounded(draw, (720, 250, 925, 520), 22, (222, 190, 122), line, 5)
    elif kind in ("fashion", "luxury"):
        draw.polygon([(540, 245), (390, 370), (320, 760), (455, 820), (540, 670), (625, 820), (760, 760), (690, 370)], fill=(227, 224, 218) if kind == "fashion" else (27, 27, 31), outline=line)
        draw.line((540, 260, 540, 675), fill=accent, width=7)
    elif kind == "cosmetic":
        rounded(draw, (405, 330, 675, 850), 45, (238, 215, 211), line, 6)
        rounded(draw, (440, 225, 640, 365), 24, accent, None)
        rounded(draw, (450, 520, 630, 650), 18, white, None)
    elif kind == "perfume":
        rounded(draw, (350, 390, 730, 835), 68, (151, 126, 174), line, 6)
        rounded(draw, (435, 230, 645, 425), 28, (35, 32, 42), accent, 5)
        rounded(draw, (440, 555, 640, 680), 18, (237, 231, 242), None)
    elif kind == "property":
        draw.polygon([(205, 560), (540, 280), (875, 560)], fill=accent)
        draw.rectangle((260, 540, 820, 885), fill=(218, 221, 216), outline=line, width=6)
        for x in (330, 510, 690): rounded(draw, (x, 625, x+90, 755), 8, (50, 73, 78), None)
        rounded(draw, (495, 720, 595, 885), 6, (91, 77, 65), None)
    else:
        rounded(draw, (245, 275, 835, 860), 58, (229, 232, 238), line, 6)
        rounded(draw, (320, 355, 760, 685), 26, (26, 33, 48), None)
        draw.line((380, 755, 700, 755), fill=accent, width=18)
        draw.line((440, 805, 640, 805), fill=accent, width=12)

def make_poster(item):
    slug, category, title, base, accent, kind = item
    image = Image.new("RGB", SIZE, base)
    glow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((130, 90, 950, 930), fill=(*accent, 115))
    image = Image.alpha_composite(image.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(95)))
    draw = ImageDraw.Draw(image)
    draw.text((80, 75), "MOVPROMPT TEMPLATE  /  01", font=font(24, True), fill=(*accent, 255))
    subject(draw, kind, accent)
    draw.line((80, 995, 1000, 995), fill=(255, 255, 255, 65), width=2)
    draw.text((80, 1040), category, font=font(24, True), fill=(225, 225, 225, 235))
    words, lines, current = title.split(), [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=font(54, True))[2] > 900 and current:
            lines.append(current); current = word
        else: current = candidate
    lines.append(current)
    y = 1090
    for line in lines:
        draw.text((80, y), line, font=font(54, True), fill=(250, 250, 248, 255)); y += 62
    draw.text((80, 1275), "ADD YOUR IMAGE  ·  8 SECONDS  ·  KUWAIT", font=font(22), fill=(215, 215, 215, 210))
    OUT.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(OUT / f"{slug}.jpg", quality=92, optimize=True, progressive=True)

for template in TEMPLATES:
    make_poster(template)

print(f"Generated {len(TEMPLATES)} posters in {OUT}")
