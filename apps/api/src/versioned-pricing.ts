import {
  AdminPricingPolicySchema,
  type AdminPricingPolicy,
  type CapabilityAlias,
} from "@movprompt/contracts";
import { ObjectId } from "mongodb";
import type { MongoDatabase } from "@movprompt/db";
import {
  CREDIT_PACKAGES,
  CUSTOM_AMOUNT_MINOR_PER_CREDIT,
  CUSTOM_TOP_UP_LIMITS,
} from "./payments/credit-packages.js";
import {
  createGenerationPricingFromEnvironment,
  GenerationPricingUnavailableError,
  InvalidGenerationConfigurationError,
  VIDEO_LENGTH_PRICE_TIERS,
  HD_RESOLUTION_SURCHARGE_CREDITS,
  type GenerationPricing,
  type GenerationProduct,
} from "./generation-pricing.js";
export type CreditCatalog = Pick<
  AdminPricingPolicy,
  "packages" | "customTopUp"
> & { pricingVersion: string };
export function defaultAdminPricingPolicy(
  environment: Readonly<Record<string, string | undefined>>,
): AdminPricingPolicy {
  const price = {
    eightSeconds: VIDEO_LENGTH_PRICE_TIERS[0]!.credits,
    fifteenSeconds: VIDEO_LENGTH_PRICE_TIERS[1]!.credits,
    twentySeconds: VIDEO_LENGTH_PRICE_TIERS[2]!.credits,
    hdSurcharge: HD_RESOLUTION_SURCHARGE_CREDITS,
  };
  return {
    version: 1,
    packages: [...CREDIT_PACKAGES],
    customTopUp: {
      ...CUSTOM_TOP_UP_LIMITS,
      amountMinorPerCredit: CUSTOM_AMOUNT_MINOR_PER_CREDIT,
    },
    video: {
      template: { ...price, hdSurcharge: 0 },
      ad_studio: price,
      advanced: price,
    },
    quoteTtlSeconds: Number(environment.GENERATION_QUOTE_TTL_SECONDS ?? 900),
    entitlements: {
      starterOnly: environment.GENERATION_STARTER_ONLY !== "false",
      starterRenders: environment.GENERATION_STARTER_RENDERS === "true",
      freeAccounts: environment.GENERATION_FREE_ACCOUNTS === "true",
    },
  };
}
export function generationPricingForPolicy(
  policy: AdminPricingPolicy,
  version: string,
): GenerationPricing {
  return {
    version,
    quoteTtlSeconds: policy.quoteTtlSeconds,
    mode: "paid",
    isAvailable: (capability: CapabilityAlias) =>
      capability === "video.cinematic" ||
      capability === "video.product_fidelity",
    price(
      capability,
      configuration,
      fallback,
      product: GenerationProduct = "template",
    ) {
      if (!this.isAvailable(capability))
        throw new GenerationPricingUnavailableError(capability);
      const root =
        configuration &&
        typeof configuration === "object" &&
        !Array.isArray(configuration)
          ? (configuration as Record<string, unknown>)
          : {};
      const nested =
        root.generation && typeof root.generation === "object"
          ? (root.generation as Record<string, unknown>)
          : root;
      const duration = nested.durationSeconds ?? fallback;
      if (duration === undefined)
        throw new InvalidGenerationConfigurationError("duration_required");
      if (
        !Number.isSafeInteger(duration) ||
        Number(duration) < 4 ||
        Number(duration) > 20
      )
        throw new InvalidGenerationConfigurationError("duration_invalid");
      const resolution = nested.resolution ?? "720p";
      if (resolution !== "480p" && resolution !== "720p")
        throw new GenerationPricingUnavailableError(capability);
      const price = policy.video[product];
      const credits =
        Number(duration) <= 8
          ? price.eightSeconds
          : Number(duration) <= 15
            ? price.fifteenSeconds
            : price.twentySeconds;
      const surcharge = resolution === "720p" ? price.hdSurcharge : 0;
      const breakdown = [
        { label: `${duration}-second video`, credits },
        ...(surcharge
          ? [{ label: "720p resolution", credits: surcharge }]
          : []),
      ];
      return { credits: credits + surcharge, breakdown };
    },
  };
}
export function createVersionedPricingResolver(
  database: MongoDatabase,
  environment: Readonly<Record<string, string | undefined>>,
) {
  const fallback = createGenerationPricingFromEnvironment(environment);
  async function current() {
    const head = await database.db
      .collection("admin_pricing_heads")
      .findOne({ key: "current" });
    if (!head?.versionId)
      return { policy: null, pricing: fallback, revision: 0, versionId: null };
    const version = await database.db
      .collection("admin_pricing_versions")
      .findOne({ _id: new ObjectId(String(head.versionId)) });
    if (!version) throw new GenerationPricingUnavailableError();
    const policy = AdminPricingPolicySchema.parse(version.policy);
    return {
      policy,
      pricing: generationPricingForPolicy(policy, `pricing:${version._id}`),
      revision: Number(head.revision),
      versionId: String(version._id),
    };
  }
  return {
    current,
    async publicSnapshot() {
      const state = await current();
      const policy = state.policy ?? defaultAdminPricingPolicy(environment);
      let version: string | null = null;
      try {
        version = state.pricing.version;
      } catch {
        /* No configured authoritative price. */
      }
      const video = (["template", "ad_studio", "advanced"] as const).flatMap(
        (product) =>
          ([8, 15, 20] as const).flatMap((durationSeconds) =>
            (["480p", "720p"] as const).map((resolution) => {
              let credits: number | null = null;
              try {
                credits = state.pricing.price(
                  "video.product_fidelity",
                  { durationSeconds, resolution },
                  durationSeconds,
                  product,
                ).credits;
              } catch {
                /* Public status remains unavailable. */
              }
              return { product, durationSeconds, resolution, credits };
            }),
          ),
      );
      return {
        pricingVersion: version,
        updatedAt: new Date().toISOString(),
        packages: policy.packages,
        customTopUp: policy.customTopUp,
        video,
      };
    },
    async catalog(): Promise<CreditCatalog> {
      const state = await current();
      const policy = state.policy ?? defaultAdminPricingPolicy(environment);
      return {
        packages: policy.packages,
        customTopUp: policy.customTopUp,
        pricingVersion: state.versionId
          ? `pricing:${state.versionId}`
          : "credit-packages-baseline-v1",
      };
    },
  };
}
