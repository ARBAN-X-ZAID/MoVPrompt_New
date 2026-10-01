import { templatePhotoIssues, type TemplatePhotoPolicy, type TemplatePhotoReference } from "@movprompt/contracts";
import type { TemplateSceneRecipe } from "./types.js";

export const LAUNCH_PHOTO_POLICIES: Readonly<Record<string, TemplatePhotoPolicy>> = {
  "premium-phone-reveal": policy("subject", 3),
  "phone-floating-ad": policy("subject", 3),
  "restaurant-food-hero": policy("subject", 1),
  "food-delivery-ad": policy("subject", 1),
  "fashion-product-showcase": policy("subject", 1),
  "luxury-fashion-reveal": policy("subject", 1),
  "cosmetic-product-commercial": policy("subject", 1),
  "perfume-advertisement": policy("subject", 1),
  "female-product-review": { version: 1, groups: [{ role: "subject", min: 1, max: 3 }, { role: "character", min: 0, max: 3 }] },
  "real-estate-property": policy("property", 5),
  "business-service-promotion": policy("artwork", 1),
  "new-york-billboard-takeover": policy("artwork", 1),
};

function policy(role: "subject" | "property" | "artwork", max: number): TemplatePhotoPolicy {
  return { version: 1, groups: [{ role, min: 1, max }] };
}

type Beats = { 15: readonly string[]; 20: readonly string[] };

/** Authored actions, not padding appended to the eight-second film. */
const LONG_BEATS: Record<string, Beats> = {
  "premium-phone-reveal": {
    15: [
      "Open on the exact device in the dark reflective studio. A rim light reveals its visible silhouette before a centered push begins.",
      "Cut to the next supplied device view, or a crop of the original. Slide along the visible edge and settle on the real buttons and finish.",
      "Show a supplied camera-module or screen view. Travel from its visible material detail back to the whole device; reflections move, geometry does not.",
      "Return to the primary view. Ease the camera to a stop and hold the unchanged device above clean lower-third space.",
    ],
    20: [
      "Establish the exact device in silhouette on the dark reflective surface; reveal its contour with a moving rim light, then begin the centered approach.",
      "Cut to a supplied alternate view. Make one slow lateral pass across the visible edge, pause on the real controls, and finish with the full supplied side in view.",
      "Cut to the remaining supplied view or a supported crop. Reveal the camera or material detail in focus, allow one restrained light sweep, then pull back without rotating into an unseen side.",
      "Match-cut to the primary hero angle. Reflections settle first, then the camera stops. Hold an uncluttered device-and-negative-space finish.",
    ],
  },
  "phone-floating-ad": {
    15: [
      "Establish the exact device floating against the gradient; let the background particles move before the device begins a gentle lift.",
      "Use the next supplied view for a controlled small tilt. Show the real visible frame and camera arrangement without revealing an unsupplied back.",
      "Let a soft highlight cross the unchanged body while the camera drifts closer. Ease the tilt back and keep particles behind the device.",
      "Center the primary device view, stop its rotation and hold a stable floating hero with clear finishing space.",
    ],
    20: [
      "Open with the exact device almost still. Establish the gradient and restrained distant particles, then lift it slowly along a short vertical path.",
      "Cut to a supplied alternate angle. Tilt slightly toward the camera, pause to show its visible material, then settle before the next cut.",
      "Reveal the remaining supplied view or a crop of the primary. A light band crosses the surface as the camera approaches and retreats; device proportions stay fixed.",
      "Return to the primary view, lower into the final centered position, and finish with near-still levitation and empty caption-safe space.",
    ],
  },
  "restaurant-food-hero": {
    15: [
      "Start close on visible food texture from the supplied dish. Travel slowly across the real surface with warm grazing light.",
      "Pull back to reveal the entire unchanged serving and original vessel. Keep the food arrangement and visible ingredients exact.",
      "Cut to another crop of the same photograph. A short tabletop slide reveals texture and moisture without adding garnish, steam, pouring or cutting.",
      "Return to the complete dish and settle into an appetizing hero with a clear lower corner for finishing.",
    ],
    20: [
      "Establish a supported macro crop, hold long enough to read the real texture, then begin a slow focus-guided push.",
      "Reveal the serving progressively from the crop to the whole plate. Pause on its actual portion and unchanged vessel in warm restaurant light.",
      "Make two clean detail-to-whole framings using only visible parts of the supplied dish. Move the camera once per framing; never simulate preparation or change ingredients.",
      "End on the original full serving, ease all movement to a stop, and hold an unobscured food hero with finishing-safe negative space.",
    ],
  },
  "food-delivery-ad": {
    15: [
      "Reveal the exact dish on a clean table, retaining only packaging actually visible in the uploaded photo.",
      "Move closer to the real portion and ingredients with a short low slide. Do not invent a delivery bag or container.",
      "Shift framing toward supplied packaging when present; otherwise show another visible dish detail. A restrained highlight leads back to the full serving.",
      "Hold the dish and any supplied packaging in a clear order-ready composition with an empty finishing area.",
    ],
    20: [
      "Open wide enough to establish the real dish and supplied context. Approach gradually while the portion, vessel and packaging remain fixed.",
      "Cut to a supported close detail, slide across the actual ingredients, and pause on texture without altering food or quantity.",
      "Move from the supplied packaging detail back to the full serving, or use a second food crop when no packaging exists. Never add a delivery person, vehicle, app or timing claim.",
      "Return to the original arrangement and settle the light and camera into a clean order-ready closing hold.",
    ],
  },
  "fashion-product-showcase": {
    15: [
      "Reveal the full uploaded garment in a clean fashion studio, retaining its visible front, proportions and drape.",
      "Push toward visible stitching, collar or pattern. Keep the framing on the supplied side and retain the exact logo.",
      "Travel across a real fabric detail, then return toward the full garment as a very gentle airflow moves only the existing loose fabric.",
      "Hold the full garment in its original orientation with no invented model or unseen rear details.",
    ],
    20: [
      "Establish the whole garment in a still editorial composition. Let soft studio light reveal its outline before the camera approaches.",
      "Move from a visible seam to its adjacent material detail, pausing to show the actual weave and print without redrawing either.",
      "Pull back gradually while one mild airflow passes through existing fabric. Keep the same side visible and avoid transformations, new folds that hide identity, or wardrobe changes.",
      "Settle into a full-length hero, allow the fabric to become still, and hold clear finishing space beside the unchanged garment.",
    ],
  },
  "luxury-fashion-reveal": {
    15: [
      "Reveal the uploaded item from shadow in the black studio. Keep its original orientation above the reflective floor.",
      "Trace its visible silhouette with a narrow light sweep while the camera makes one small lateral glide.",
      "Move closer to visible material or hardware, then widen to show the same item. Do not invent a back, accessory or fastening.",
      "Lock the original hero angle into a high-contrast finish with unobstructed identity and negative space.",
    ],
    20: [
      "Start with the uploaded item in restrained shadow; reveal the visible edges in sequence without changing its cut or shape.",
      "Glide along the supplied face while the spotlight reveals material and real hardware. Pause on the strongest supported detail.",
      "Use a clean crop change to a second visible detail, then draw back into the full silhouette. Reflections remain secondary and physically plausible.",
      "Return to the opening angle in fully established luxury light, settle the camera and hold the exact item above clean finishing space.",
    ],
  },
  "cosmetic-product-commercial": {
    15: [
      "Introduce the exact cosmetic package upright in the beige studio with its real label facing the viewer.",
      "Move toward visible cap, applicator or container material without opening or transforming the product.",
      "Let liquid-like light reflections cross the surroundings, then pull back; fine particles remain behind the unchanged package.",
      "Hold the complete product with its original label, shade and proportions clearly visible.",
    ],
    20: [
      "Establish the uploaded package in soft beige light, hold its readable identity, then start a centered slow approach.",
      "Travel across the visible cap-to-container detail. Show the actual material finish and settle briefly without exposing an unseen side.",
      "Widen as one restrained reflection passes behind the package. Introduce a few distant particles, then let them settle; never add liquid contents, cosmetic effects or a face.",
      "Return to the exact primary package view and hold a calm beauty-commercial finish with clear overlay-safe space.",
    ],
  },
  "perfume-advertisement": {
    15: [
      "Establish the exact uploaded subject above glossy aqua water and begin a slow descent. Keep its supplied face sharp and unchanged.",
      "Bring wet citrus and berries from the outer edges and behind the hero in staggered streams, never across its identifying details.",
      "The unchanged subject meets the water; create one crown splash. Fruit lands to either side as droplets rise and then begin to fall.",
      "Settle the splash and floating fruit around the sharp central subject. Finish with a closer refreshing hero and clear negative space.",
    ],
    20: [
      "Hold the exact uploaded subject above calm aqua water, establish its real silhouette, then descend slowly while distant droplets catch the light.",
      "Stage fruit in two waves: citrus enters from the sides, then berries pass behind. Maintain separation from the subject; do not spin it to reveal unseen geometry.",
      "Let the subject contact the water once. Follow the crown splash from rise through suspended droplets to falling ripples, with fruit impacts away from its face.",
      "Ease closer as the water calms. Keep the same subject intact and sharp, fruit framing it from the sides, then hold the final refreshing composition.",
    ],
  },
  "female-product-review": {
    15: [
      "Introduce one adult presenter holding the exact product in a natural creator frame. Establish both identities before any movement; mouth stays still.",
      "Bring the product closer using a believable grip. Show the next supplied product view or a crop of the primary while preserving the presenter's face.",
      "Make one restrained handling gesture supported by the product photograph. Character angle references guide the same person's appearance, never additional people.",
      "Return to a calm presenter-and-product frame. Hold the real product clearly toward the camera without speech or testimonial gestures.",
    ],
    20: [
      "Open with the same adult presenter and exact product already visible. Establish the neutral expression, wardrobe and natural room light before a small approach.",
      "Move the product toward the camera, pause on its visible label or material, then show a supplied alternate product angle through a clean cut.",
      "Demonstrate only a safe hold or repositioning justified by the references. Cut to another supplied product detail and return to the same presenter without changing face, hands or wardrobe.",
      "Settle into the original medium frame with the product unobscured. Keep the mouth still and finish with a warm neutral expression and clean finishing space.",
    ],
  },
  "real-estate-property": {
    15: [
      "Establish the exact supplied property view in natural light with a slow straight architectural push.",
      "Move toward a visible finish or fixture within the same photograph; keep room geometry and all permanent features unchanged.",
      "Use a supported crop and restrained lateral movement to show depth without fabricating another room or outside view.",
      "Return to the original wide photograph and hold a clear property-listing finish.",
    ],
    20: [
      "Hold the original wide property view, establish its real geometry and daylight, then begin a very slow forward movement.",
      "Reveal a visible finish through a controlled crop change, pause on the actual detail, and maintain the original window positions and proportions.",
      "Return to a wider supported crop and make a small lateral parallax move. Keep walls, furniture, fixtures and outdoor views exactly as supplied.",
      "Return to the initial wide composition, settle into a stable architectural hero and hold empty contact-safe space.",
    ],
  },
  "business-service-promotion": {
    15: [
      "Establish the exact uploaded artwork centered in a clean modern studio, retaining its proportions and existing content.",
      "Make a small push toward a visible artwork detail while a restrained light sweep travels around its edges.",
      "Ease back to the whole artwork with subtle depth in the surroundings. Never add interface, icons, testimonials or extra screens.",
      "Hold the unchanged full artwork in a balanced finish with empty space for confirmed campaign copy.",
    ],
    20: [
      "Introduce the uploaded artwork in a still professional composition; establish its complete layout before moving closer.",
      "Travel toward one real visual detail and pause, keeping existing text and brand marks intact rather than redrawing them.",
      "Widen through a restrained background light progression. Allow only slight camera parallax around the artwork, with no new services, screens, badges or business claims.",
      "Return to the original full artwork and hold a clean finish, allowing the surrounding light and camera to settle.",
    ],
  },
  "new-york-billboard-takeover": {
    15: [
      "Establish a generic Times Square plaza at blue hour with one empty neutral billboard. Keep neighboring signage unreadable and people distant.",
      "Reveal the supplied artwork as one exact rectangular insert on that billboard. Let the reveal finish before a restrained five-percent push begins; preserve all supplied proportions and content.",
      "Hold the same billboard and artwork with the lower quarter clear. Only soft distant crowd movement continues; introduce no other advertisements.",
    ],
    20: [
      "Hold the blue-hour plaza long enough to establish one dominant empty billboard and the fixed camera geography. Keep other screens neutral.",
      "Reveal the exact artwork on the billboard, hold its completed appearance, then make one gradual five-percent push and ease to a stop. Keep the artwork intact throughout.",
      "Maintain the final locked billboard composition with the supplied artwork unchanged. Let distant crowd motion settle beneath the clean lower-quarter finishing area.",
    ],
  },
};

export type DurationRecipe = { id: string; scenes: TemplateSceneRecipe[] };
export type DurationRecipes = Record<string, DurationRecipe>;

export function buildDurationRecipes(id: string, base: readonly TemplateSceneRecipe[], version = 2): DurationRecipes {
  const beats = LONG_BEATS[id];
  if (!beats) throw new Error(`launch_duration_recipe_missing:${id}`);
  const referenceSafe = (value: string) => value
    .replaceAll("exact front and rear identity visible", "only the supplied device view visible")
    .replace(/screen as a clean neutral gradient|screen still a clean neutral gradient|screen stays an empty neutral surface throughout|screen still empty/gi, "preserve supplied screen content without inventing an interface")
    .replaceAll("slow product rotation", "restrained supplied-view changes")
    .replaceAll("gentle twenty-degree rotation", "restrained in-plane tilt")
    .replaceAll("Exact phone completes a slow partial rotation without changing proportions", "Cut to another supplied phone view, or a supported detail crop when only one photo exists")
    .replaceAll("Exact device tilts to reveal its real edge, camera layout and material", "The device makes a small in-plane tilt while only supplied edges and material remain visible")
    .replaceAll("A smooth move around the same garment", "A smooth move across the visible face of the garment")
    .replaceAll("a generic adult presenter", "the consistent adult presenter defined by the reference map")
    .replaceAll("A generic adult presenter", "The consistent adult presenter defined by the reference map")
    .replaceAll("A believable hold, wear or demonstration matches the product", "A restrained hold presents the product without wearing, opening or transforming it");
  const result: DurationRecipes = { "8": { id: `${id}-v${version}-8s`, scenes: base.map(scene => ({
    ...scene, direction: referenceSafe(scene.direction), shot: referenceSafe(scene.shot),
    camera: /orbit|semicircular/.test(scene.camera) ? "short lateral slide across the supplied face, no unseen sides" : scene.camera,
  })) } };
  for (const duration of [15, 20] as const) {
    const timings = id === "new-york-billboard-takeover"
      ? duration === 15 ? [4, 7, 4] : [5, 10, 5]
      : duration === 15 ? [3, 4, 5, 3] : [4, 6, 6, 4];
    result[String(duration)] = {
      id: `${id}-v${version}-${duration}s`,
      scenes: base.map((scene, index) => ({
        ...scene,
        duration: timings[index]!,
        direction: beats[duration][index]!,
        shot: "Use only reference-supported composition and visible details.",
        camera: index === base.length - 1 ? "ease to a locked closing hold" : "one restrained camera move following the timed action",
      })),
    };
  }
  return result;
}

export function resolveDurationRecipe(input: {
  id: string;
  durationRecipes: DurationRecipes;
  duration: number;
  photos: readonly TemplatePhotoReference[];
}): DurationRecipe {
  const base = input.durationRecipes[String(input.duration)];
  if (!base) throw new Error("template_duration_unsupported");
  const scenes = base.scenes.map(scene => ({ ...scene }));
  const policy = LAUNCH_PHOTO_POLICIES[input.id];
  const primaryRole = policy?.groups[0]?.role ?? "subject";
  const subjects = input.photos.flatMap((photo, index) => (photo.referenceRole ?? primaryRole) === primaryRole ? [index + 1] : []);
  if (input.id === "real-estate-property" && subjects.length > 1 && subjects.length <= 5) {
    const sequence = [...subjects, subjects[0]!];
    const count = sequence.length;
    const each = Math.floor(input.duration / count);
    return { id: base.id, scenes: sequence.map((reference, index) => {
      const last = index === count - 1;
      return {
        ...scenes[Math.min(index, scenes.length - 1)]!,
        id: `${input.id}-view-${index + 1}`,
        title: { en: last ? "Property close" : `Property view ${index + 1}`, ar: last ? "ختام العقار" : `منظر العقار ${index + 1}` },
        duration: each + (index < input.duration % count ? 1 : 0),
        direction: `${last ? "Return to" : "Show"} [Image ${reference}] only. ${input.duration === 8 ? "Establish the view, then make a small forward push." : input.duration === 15 ? "Establish the full view, then approach a visible architectural detail slowly." : "Hold the full view, glide toward a real visible finish, then ease into a stable composition."} Preserve this photograph's exact room geometry, furnishings and outside view. ${last ? "End with clean contact-safe space." : "Use a clean cut to the next supplied view; never invent a connecting corridor or morph rooms."}`,
        shot: `Exact property photograph [Image ${reference}], no invented architecture`,
        camera: last ? "locked wide closing hold" : "small straight architectural push",
        continuityAnchor: "Same property and consistent grade; distinct rooms remain distinct. Do not infer spatial connections between photos.",
      };
    }) };
  }
  return { id: base.id, scenes: scenes.map((scene, index) => {
    const reference = subjects[index === scenes.length - 1 ? 0 : Math.min(index, subjects.length - 1)] ?? 1;
    return { ...scene, direction: `${scene.direction} Subject reference: [Image ${reference}]. Use supplied views only; never reveal an unseen side. ${index === scenes.length - 1 ? "Finish with a stable hold." : "Finish this beat before a clean motivated cut."}` };
  }) };
}

export function assertTemplatePhotos(templateId: string, photos: readonly TemplatePhotoReference[]): void {
  const policy = LAUNCH_PHOTO_POLICIES[templateId];
  if (!policy) throw new Error("template_photo_policy_missing");
  const issues = templatePhotoIssues(policy, photos);
  if (issues.length) throw new Error(issues.join(","));
}
