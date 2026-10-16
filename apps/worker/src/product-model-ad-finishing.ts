import { createCanvas, loadImage } from "@napi-rs/canvas";
import { AD_STUDIO_BRAND_AD_ID, PRODUCT_MODEL_AD_ID } from "@movprompt/contracts";
import { CreativeBriefSchema, assertAdStudioBrandAd, assertProductModelAd } from "@movprompt/creative-engine";

export type ModelAdLayers = { opening?: Uint8Array; closing: Uint8Array; closingSeconds: number };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const BRAND_COLOR = /^#[0-9a-f]{6}$/i;

/** Deterministic custom-form finishing: the exact logo and copy are drawn here, never by the video model. */
export async function modelAdLayers(configuration: unknown, width: number, height: number, readLogo?: (key: string, checksum: string) => Promise<Uint8Array>): Promise<ModelAdLayers | null> {
  const root = object(configuration);
  const generation = root.generation ? object(root.generation) : root;
  const templateId = object(generation.creativeBrief).templateId;
  if (templateId !== PRODUCT_MODEL_AD_ID && templateId !== AD_STUDIO_BRAND_AD_ID) return null;
  const brief = CreativeBriefSchema.parse(generation.creativeBrief);
  const references = Array.isArray(generation.references) ? generation.references : [];
  const brandAd = templateId === AD_STUDIO_BRAND_AD_ID;
  const aspectRatio = typeof generation.aspectRatio === "string" ? generation.aspectRatio : "9:16";
  if (brandAd) assertAdStudioBrandAd(brief, references, aspectRatio);
  else assertProductModelAd(brief, references, "9:16");
  const logoChecksum = brandAd ? brief.adStudioBrandAd!.logoChecksum : brief.productModelAd!.brandKit.logoChecksum;
  const projectColor = object(root.creatorProject).brandColor;
  const accent = brandAd ? (typeof projectColor === "string" && BRAND_COLOR.test(projectColor) ? projectColor : "#c99946") : brief.productModelAd!.brandKit.primaryColor;
  const serif = !brandAd && brief.productModelAd!.brandKit.fontStyle === "serif";
  const errorPrefix = brandAd ? "ad_studio_brand_ad" : "product_model_ad";
  let logo: Uint8Array | undefined;
  if (logoChecksum) {
    const images = object(object(root.creatorProject).product).images;
    const asset = Array.isArray(images) ? images.map(object).find(image => image.checksum === logoChecksum && image.referenceRole === "artwork" && image.selected === false) : null;
    if (!asset || typeof asset.storagePath !== "string" || !readLogo) throw new Error(`${errorPrefix}_logo_unavailable`);
    logo = await readLogo(asset.storagePath, logoChecksum);
  }
  // Size from the short edge so square and landscape cards fit like portrait ones.
  const base = Math.min(width, height);
  const card = async (values: string[], top: boolean, logoBytes?: Uint8Array) => {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    const padding = Math.round(base * .045);
    const panelWidth = Math.min(width - padding * 2, Math.round(base * 1.6));
    const left = Math.round((width - panelWidth) / 2);
    const logoHeight = logoBytes ? Math.round(base * .065) : 0;
    const layout = (font: number) => {
      context.font = `600 ${font}px ${serif ? "serif" : '"MovPrompt Campaign"'}`;
      const lines: string[] = [];
      for (const value of values.filter(Boolean)) {
        let line = "";
        for (const character of value) {
          if (line && context.measureText(line + character).width > panelWidth - padding * 2) { lines.push(line); line = ""; }
          line += character;
        }
        if (line) lines.push(line);
      }
      const lineHeight = Math.ceil(font * 1.45);
      return { lines, lineHeight, panelHeight: lines.length * lineHeight + padding * 2 + logoHeight };
    };
    // Shrink long copy instead of failing after the video has been generated.
    let font = Math.round(base * .032);
    let fitted = layout(font);
    while (fitted.panelHeight > height * .38 && font > Math.round(base * .016)) fitted = layout(--font);
    const { lines, lineHeight, panelHeight } = fitted;
    if (panelHeight > height * .38) throw new Error(`${errorPrefix}_copy_does_not_fit`);
    const y = top ? Math.round(height * .1) : height - Math.round(height * .12) - panelHeight;
    context.fillStyle = "rgba(17,17,19,0.92)";
    context.fillRect(left, y, panelWidth, panelHeight);
    context.fillStyle = accent;
    context.fillRect(left, y, panelWidth, Math.max(3, Math.round(base * .006)));
    if (logoBytes) {
      const image = await loadImage(logoBytes);
      const scale = Math.min((panelWidth - padding * 2) / image.width, logoHeight / image.height);
      context.drawImage(image, (width - image.width * scale) / 2, y + padding, image.width * scale, image.height * scale);
    }
    context.fillStyle = "#ffffff"; context.textAlign = "center"; context.textBaseline = "middle";
    lines.forEach((line, index) => {
      context.direction = /[\u0600-\u06ff]/u.test(line) ? "rtl" : "ltr";
      context.fillText(line, width / 2, y + padding + logoHeight + lineHeight * (index + .5));
    });
    return new Uint8Array(canvas.toBuffer("image/png"));
  };
  const closingSeconds = brief.scenes.at(-1)!.duration;
  if (brandAd) {
    const settings = brief.adStudioBrandAd!;
    return { closing: await card([settings.brandName, settings.website, settings.socials], false, logo), closingSeconds };
  }
  const settings = brief.productModelAd!;
  return {
    ...(settings.openingMessage ? { opening: await card([settings.openingMessage], true) } : {}),
    closing: await card([settings.brandKit.name, settings.brandKit.tagline, ...settings.brandKit.sellingPoints, settings.sellingPoint, brief.product.offer, brief.product.callToAction, settings.brandKit.whatsapp, settings.brandKit.website], false, logo),
    closingSeconds,
  };
}
