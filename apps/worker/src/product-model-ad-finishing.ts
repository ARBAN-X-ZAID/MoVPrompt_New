import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PRODUCT_MODEL_AD_ID } from "@movprompt/contracts";
import { CreativeBriefSchema, assertProductModelAd } from "@movprompt/creative-engine";

export type ModelAdLayers = { opening?: Uint8Array; closing: Uint8Array; closingSeconds: number };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function modelAdLayers(configuration: unknown, width: number, height: number, readLogo?: (key: string, checksum: string) => Promise<Uint8Array>): Promise<ModelAdLayers | null> {
  const root = object(configuration);
  const generation = root.generation ? object(root.generation) : root;
  if (object(generation.creativeBrief).templateId !== PRODUCT_MODEL_AD_ID) return null;
  const brief = CreativeBriefSchema.parse(generation.creativeBrief);
  assertProductModelAd(brief, Array.isArray(generation.references) ? generation.references : [], "9:16");
  const settings = brief.productModelAd!;
  let logo: Uint8Array | undefined;
  if (settings.brandKit.logoChecksum) {
    const images = object(object(root.creatorProject).product).images;
    const asset = Array.isArray(images) ? images.map(object).find(image => image.checksum === settings.brandKit.logoChecksum && image.referenceRole === "artwork" && image.selected === false) : null;
    if (!asset || typeof asset.storagePath !== "string" || !readLogo) throw new Error("product_model_ad_logo_unavailable");
    logo = await readLogo(asset.storagePath, settings.brandKit.logoChecksum);
  }
  const card = async (values: string[], top: boolean, logoBytes?: Uint8Array) => {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    const padding = Math.round(width * .045);
    const font = Math.round(width * .032);
    context.font = `600 ${font}px ${settings.brandKit.fontStyle === "serif" ? "serif" : '"MovPrompt Campaign"'}`;
    const lines: string[] = [];
    for (const value of values.filter(Boolean)) {
      let line = "";
      for (const character of value) {
        if (line && context.measureText(line + character).width > width - padding * 4) { lines.push(line); line = ""; }
        line += character;
      }
      if (line) lines.push(line);
    }
    const lineHeight = Math.ceil(font * 1.45);
    const logoHeight = logoBytes ? Math.round(height * .065) : 0;
    const panelHeight = lines.length * lineHeight + padding * 2 + logoHeight;
    if (panelHeight > height * .38) throw new Error("product_model_ad_copy_does_not_fit");
    const y = top ? Math.round(height * .1) : height - Math.round(height * .12) - panelHeight;
    context.fillStyle = "rgba(17,17,19,0.92)";
    context.fillRect(padding, y, width - padding * 2, panelHeight);
    context.fillStyle = settings.brandKit.primaryColor;
    context.fillRect(padding, y, width - padding * 2, Math.max(3, Math.round(width * .006)));
    if (logoBytes) {
      const image = await loadImage(logoBytes);
      const scale = Math.min((width - padding * 4) / image.width, logoHeight / image.height);
      context.drawImage(image, (width - image.width * scale) / 2, y + padding, image.width * scale, image.height * scale);
    }
    context.fillStyle = "#ffffff"; context.textAlign = "center"; context.textBaseline = "middle";
    lines.forEach((line, index) => {
      context.direction = /[\u0600-\u06ff]/u.test(line) ? "rtl" : "ltr";
      context.fillText(line, width / 2, y + padding + logoHeight + lineHeight * (index + .5));
    });
    return new Uint8Array(canvas.toBuffer("image/png"));
  };
  return {
    ...(settings.openingMessage ? { opening: await card([settings.openingMessage], true) } : {}),
    closing: await card([settings.brandKit.name, settings.brandKit.tagline, ...settings.brandKit.sellingPoints, settings.sellingPoint, brief.product.offer, brief.product.callToAction, settings.brandKit.whatsapp, settings.brandKit.website], false, logo),
    closingSeconds: brief.scenes.at(-1)!.duration,
  };
}
