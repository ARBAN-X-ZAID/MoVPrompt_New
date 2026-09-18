// Pure helper that inspects the current Ads Studio inputs and decides
// whether to nudge the user to add more references before generating an ad.
//
// Goal: keep all generation paths working, but warn upfront when the model is
// likely to invent or distort the real product.

export type AccuracyRiskLevel = "none" | "low" | "medium" | "high";

export type AccuracyRiskCode =
  | "no-references"
  | "logo-only"
  | "single-angle"
  | "missing-brand-identity";

export interface AccuracyRisk {
  code: AccuracyRiskCode;
  title: string;
  detail: string;
  fixLabel: string;
  fix: "add-photos" | "add-brand" | "add-identity";
}

export interface AccuracyRiskInput {
  subject: "product" | "character" | "scene" | string;
  brandKits: Array<{
    name?: string | null;
    logo_url?: string | null;
    references?: Array<{ kind: string; image_url?: string | null }> | null;
  }>;
  hasCharacterRef: boolean;
  hasLocationImage: boolean;
  hasBrandIdentity: boolean;
}

export interface AccuracyRiskResult {
  level: AccuracyRiskLevel;
  risks: AccuracyRisk[];
  primaryFix: AccuracyRisk["fix"] | null;
  primaryBrandKitName: string | null;
}

const angleCount = (b: AccuracyRiskInput["brandKits"][number]) =>
  (b.references ?? []).filter((r) => r.kind === "angle" && r.image_url).length;

export function evaluateAccuracyRisk(input: AccuracyRiskInput): AccuracyRiskResult {
  const risks: AccuracyRisk[] = [];
  const { subject, brandKits, hasCharacterRef, hasLocationImage, hasBrandIdentity } = input;

  const anyReference =
    brandKits.some((b) => b.logo_url || angleCount(b) > 0) ||
    hasCharacterRef ||
    hasLocationImage;

  // Risk A — no references at all. Highest fidelity risk for product ads.
  if (!anyReference) {
    risks.push({
      code: "no-references",
      title: "No reference images",
      detail:
        "The model will invent how your product looks. Upload at least one photo so the real product appears in the video.",
      fixLabel: "Add product photos",
      fix: "add-photos",
    });
  }

  // Risk B — logo only, no angle photos (product subject).
  let logoOnlyName: string | null = null;
  if (subject === "product") {
    const logoOnly = brandKits.find((b) => b.logo_url && angleCount(b) === 0);
    if (logoOnly) {
      logoOnlyName = logoOnly.name || "Your product";
      risks.push({
        code: "logo-only",
        title: `${logoOnlyName}: logo only`,
        detail:
          "We have your logo but no product photos. Add 1–3 angle photos in the brand kit so the model renders the real product, not a generic stand-in.",
        fixLabel: "Add angle photos",
        fix: "add-photos",
      });
    }
  }

  // Risk C — exactly one angle photo, no logo, no brand identity. Still works
  // (image-to-video), but multi-angle locks identity better.
  if (subject === "product" && !risks.length) {
    const singleAngleKit = brandKits.find(
      (b) => !b.logo_url && angleCount(b) === 1,
    );
    if (singleAngleKit) {
      risks.push({
        code: "single-angle",
        title: "Only one angle",
        detail:
          "One photo works, but adding 2–3 more angles locks the product's shape, color, and packaging across the shot for a more consistent render.",
        fixLabel: "Add more angles",
        fix: "add-photos",
      });
    }
  }

  // Risk D — soft nudge: angles exist but no brand identity (colors, tagline).
  if (
    subject === "product" &&
    !hasBrandIdentity &&
    brandKits.some((b) => angleCount(b) >= 1)
  ) {
    risks.push({
      code: "missing-brand-identity",
      title: "No brand identity set",
      detail:
        "Add brand colors, typography, and tagline so the ad's mood matches your brand — not just the product shape.",
      fixLabel: "Set brand identity",
      fix: "add-identity",
    });
  }

  let level: AccuracyRiskLevel = "none";
  if (risks.some((r) => r.code === "no-references" || r.code === "logo-only")) {
    level = "high";
  } else if (risks.some((r) => r.code === "single-angle")) {
    level = "medium";
  } else if (risks.length > 0) {
    level = "low";
  }

  const primary = risks[0] ?? null;

  return {
    level,
    risks,
    primaryFix: primary?.fix ?? null,
    primaryBrandKitName: logoOnlyName,
  };
}

export function shortTip(result: AccuracyRiskResult): string | null {
  if (!result.risks.length) return null;
  const r = result.risks[0];
  switch (r.code) {
    case "no-references":
      return "Tip: upload a product photo for an accurate render.";
    case "logo-only":
      return "Tip: add 1–3 angle photos so the real product shows up.";
    case "single-angle":
      return "Tip: add more angles for a more consistent product render.";
    case "missing-brand-identity":
      return "Tip: set brand colors and tagline for an on-brand look.";
    default:
      return null;
  }
}
