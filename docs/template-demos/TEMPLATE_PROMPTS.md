# Eleven reusable Seedance template recipes

MovPrompt publishes the ten supplied version-one recipes plus the New York Billboard Takeover recipe. Each recipe is eight seconds with four fixed scenes and accepts an uploaded R2 image through the product-fidelity reference pipeline. The server keeps `bytedance/seedance-2.5`; the source document’s Seedance 1.0 wording is prompt guidance only.

The client image is authoritative. The template controls scene order, camera, lighting, composition and motion. Seedance remains generative, so repeated runs follow the same direction without promising identical pixels. Price, offer, location, phone number, booking destination and CTA are deterministic finishing overlays. Empty optional facts are omitted.

Source: `packages/creative-engine/src/catalog.ts`. Identity policy and confirmed-fact compilation: `packages/creative-engine/src/prompt-compiler.ts`.

## Mobile / Electronics

### Premium Phone Reveal — `premium-phone-reveal-v1`

Dark premium studio, reflective surface, precise rim light and a controlled light sweep.

1. Upright reference phone reveal with a slow centered push.
2. Light sweep across the exact camera module, frame and buttons.
3. Slow partial orbit with unchanged proportions and screen.
4. Stable close hero frame with lower-third overlay space.

### Phone Floating Advertisement — `phone-floating-ad-v1`

Futuristic gradient studio, vertical float, subtle particles and restrained rotation.

1. Exact reference phone floats vertically.
2. Controlled twenty-degree orbit reveals its real edge and material.
3. Soft light moves across the unchanged screen and body.
4. Front-readable hero hold with end-card space.

## Food / Restaurants

### Restaurant Food Hero Shot — `restaurant-food-hero-v1`

Premium table, dark restaurant background, warm side light and appetising macro detail.

1. Exact supplied dish appears in its real plating.
2. Macro detail preserves ingredients, portion, texture and garnish.
3. Natural steam and a restrained three-quarter arc.
4. Stable hero frame with offer-safe space.

### Food Delivery Advertisement — `food-delivery-ad-v1`

Modern tabletop, supplied packaging, soft highlights and a semicircular camera move.

1. Exact dish and only the packaging that was supplied.
2. Hero food detail preserves portion and plating.
3. Highlight passes across food and packaging without invented labels.
4. Order-ready locked composition.

## Clothing / Fashion

### Fashion Product Showcase — `fashion-product-showcase-v1`

Minimal luxury studio with a top-to-bottom light sweep.

1. Exact garment centered with its original cut and drape.
2. Light reveals real fabric, stitching, pattern and logo.
3. Subtle orbit preserves construction and proportions.
4. Clean editorial hero frame.

### Luxury Brand Product Reveal — `luxury-fashion-reveal-v1`

Black studio, reflective floor, focused spotlight and high-contrast finish.

1. Exact product emerges from shadow.
2. Spotlight traces the true silhouette, material and hardware.
3. Gentle parallax adds depth without altering the item.
4. Luxury close with title-safe space.

## Beauty / Cosmetics

### Cosmetic Product Commercial — `cosmetic-product-commercial-v1`

Soft beauty studio, liquid reflections, fine particles and a gentle push.

1. Exact package stands upright with unchanged label.
2. Light travels across the real container, cap and material.
3. Fine particles remain behind the product.
4. Clean beauty hero with overlay-safe space.

### Perfume Advertisement — `perfume-advertisement-v1`

Dark reflective surface, controlled mist, precise light sweep and subtle bottle rotation.

1. Exact bottle, cap, glass and label reveal.
2. Mist stays behind while light shows the true liquid colour.
3. Restrained orbit preserves the silhouette and label.
4. Elegant end frame with CTA-safe negative space.

## Real Estate / Business Services

### Real Estate Property Advertisement — `real-estate-property-v1`

Premium architectural listing with natural daylight and smooth, restrained motion.

1. Wide view preserves architecture and room geometry.
2. Daylight reveals real finishes, fixtures and layout.
3. Environmental motion adds life without inventing rooms, views or features.
4. Stable listing hero with contact-safe space.

### Business / Service Promotional Video — `business-service-promotion-v1`

Modern professional studio with the supplied service artwork, app screen or business image.

1. Uploaded artwork appears centered and unchanged.
2. Light sweep preserves brand marks and interface.
3. Subtle depth layers leave factual-copy safe zones.
4. Clear professional end frame.

## Advertising

### New York Billboard Takeover — `new-york-billboard-takeover-v1`

Blue-hour Times Square-style New York plaza with one dominant digital billboard, a natural anonymous crowd, accurate screen perspective and no readable unrelated advertising.

1. Establish the busy plaza around the single billboard carrying the exact uploaded artwork.
2. Push toward the screen while preserving the artwork's logo, colours, proportions, layout and readable text.
3. Show anonymous people naturally watching as billboard light reflects across the plaza.
4. Hold the unchanged billboard artwork with safe space for deterministic business-name and CTA overlays.

Exclude third-party logos, readable unrelated advertising, celebrities, duplicated billboards, distorted screens and invented campaign facts.

## Poster publishing

Generate the deterministic, provider-free poster files:

```bash
python3 scripts/infra/generate-template-posters.py
```

Publish and checksum-verify the eleven posters in the configured R2 template-preview bucket:

```bash
bun --env-file=.env scripts/infra/publish-r2-templates.ts
```

The object keys are `templates/v1/<template-id>.jpg`. Video object keys remain empty until matching demos receive separate approval.
