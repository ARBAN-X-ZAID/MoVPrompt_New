import { createGuestAccess } from "./guest-access.js";
import { authEnvironmentFromEnv, createMovPromptAuth } from "@movprompt/auth";
import {
  createMongoDatabase,
  createMongoGenerationService,
  createMongoServiceHeartbeatRepository,
  ensureMongoRuntime,
  mongoConfigFromEnv,
} from "@movprompt/db";
import { createCapabilityRegistryFromEnvironment } from "@movprompt/providers";
import { r2StorageConfigFromEnv, R2Storage } from "@movprompt/storage";
import type { CreateApiOptions, ReadinessDependency } from "./app.js";
import { createMongoAssetRepository } from "./mongo-asset-repository.js";
import { createAssetStorageGateway } from "./asset-storage.js";
import { createBetterAuthGateway } from "./auth-gateway.js";
import type { ApiConfig } from "./config.js";
import { createAuthEmailDeliveryFromEnv } from "./email.js";
import { createGenerationPricingFromEnvironment } from "./generation-pricing.js";
import { createMongoGenerationRepository } from "./mongo-generation-repository.js";
import { createCampaignEligibilityService } from "./campaign-eligibility.js";
import { createGenerationApiService } from "./generation-service.js";
import { createGenerationAvailabilityService } from "./generation-availability.js";
import { createMongoCreatorRepository } from "./mongo-creator-repository.js";
import { createMongoGuestClaimRepository } from "./mongo-guest-claim-repository.js";
import { createGuestClaimService } from "./guest-claim-service.js";
import { createRemoteImageFetcher } from "./remote-image-fetcher.js";
import { createMongoRequestRateLimiter } from "./request-rate-limiter.js";
import { createSourceScanner } from "./source-scanner.js";

export type RuntimeServices = Pick<
  CreateApiOptions,
  | "guestAccess"
  | "templatePreviewStorage"
  | "authGateway"
  | "assetRepository"
  | "assetStorage"
  | "remoteImageFetcher"
  | "generationService"
  | "generationAvailability"
  | "capabilityRegistry"
  | "creatorRepository"
  | "guestClaimService"
  | "sourceScanner"
  | "requestRateLimiter"
  | "readinessDependencies"
> & {
  close(): Promise<void>;
};

export function createRuntimeServices(
  config: ApiConfig,
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeServices {
  const authenticationEnabled = config.featureFlags.authentication;
  const assetsEnabled = config.featureFlags.assets;
  const generationEnabled = config.featureFlags.generation;

  if ((assetsEnabled || generationEnabled) && !authenticationEnabled) {
    throw new Error("FEATURE_ASSETS and FEATURE_GENERATION require FEATURE_AUTHENTICATION=true");
  }
  if (generationEnabled && !assetsEnabled) {
    throw new Error("FEATURE_GENERATION requires FEATURE_ASSETS=true");
  }

  const database = createMongoDatabase({
    ...mongoConfigFromEnv(environment),
    applicationName: `${config.serviceName}-${config.environment}`,
  });
  const requestRateLimiter = createMongoRequestRateLimiter({
    database,
    ...config.requestRateLimit,
  });
  const sourceScanner = createSourceScanner();
  const remoteImageFetcher = createRemoteImageFetcher();
  let mongoReady: Promise<void> | undefined;
  const readinessDependencies: ReadinessDependency[] = [
    {
      name: "mongodb",
      check: () => {
        mongoReady ??= ensureMongoRuntime(database).catch((error) => {
          mongoReady = undefined;
          throw error;
        });
        return mongoReady;
      },
    },
  ];

  if (!authenticationEnabled) {
    return { sourceScanner, requestRateLimiter, readinessDependencies, close: () => database.close() };
  }
  const authEnvironment = authEnvironmentFromEnv(environment);
  const emailDelivery = createAuthEmailDeliveryFromEnv(environment);
  if (!emailDelivery.available) {
    console.warn("[MovPrompt] SMTP is not configured. Sign-up and sign-in remain available; verification and password-reset email delivery are unavailable.");
  }
  const auth = createMovPromptAuth({
    db: database,
    environment: authEnvironment,
    sendEmail: emailDelivery.sendEmail,
  });

  const authGateway = createBetterAuthGateway(auth, authEnvironment.publicCapability);
  const guestAccess = createGuestAccess(database, authGateway, environment);
  const capabilities = createCapabilityRegistryFromEnvironment(environment);
  const pricing = createGenerationPricingFromEnvironment(environment);
  const generationRepository = createMongoGenerationRepository(database);
  const campaignEligibility = createCampaignEligibilityService();
  const generationService = assetsEnabled
    ? createGenerationApiService({
        repository: generationRepository,
        isGuestOwner: guestAccess.isGuest,
        generation: createMongoGenerationService(database, environment),
        pricing,
        capabilities,
        starterOnly: environment.GENERATION_STARTER_ONLY?.trim().toLowerCase() !== "false",
        starterEligibilityRequiresEmailVerification:
          authEnvironment.firstCampaignVerificationPolicy !== "deferred_until_after_first_campaign",
      })
    : undefined;
  const creatorRepository = createMongoCreatorRepository(database);
  const guestClaimService = createGuestClaimService({
    repository: createMongoGuestClaimRepository(database),
    campaignEligibility,
  });
  if (!assetsEnabled) {
    return {
      authGateway: createBetterAuthGateway(auth, authEnvironment.publicCapability),
      creatorRepository,
      guestClaimService,
      sourceScanner,
      requestRateLimiter,
      ...(generationService ? { generationService } : {}),
      capabilityRegistry: capabilities,
      readinessDependencies,
      close: () => database.close(),
    };
  }

  let storage: R2Storage;
  try {
    storage = new R2Storage(r2StorageConfigFromEnv(environment));
  } catch (error) {
    const message = error instanceof Error ? error.message : "R2 configuration is incomplete";
    console.warn(`[MovPrompt] Storage unavailable: ${message}. Fill the R2 settings and restart.`);
    readinessDependencies.push({ name: "r2-storage", check: async () => { throw new Error(message); } });
    return { authGateway, guestAccess, creatorRepository, guestClaimService, sourceScanner, requestRateLimiter, capabilityRegistry: capabilities, readinessDependencies, close: () => database.close() };
  }
  readinessDependencies.push({ name: "r2-storage", check: async () => {
    await Promise.all([...new Set([storage.assetsBucket, storage.outputsBucket, storage.previewsBucket!])].map(bucket => storage.checkBucket(bucket)));
  } });
  const assetStorage = createAssetStorageGateway(storage);
  const storageGuestAccess = createGuestAccess(database, authGateway, environment, assetStorage);
  const generationAvailability = createGenerationAvailabilityService({
    enabled: generationEnabled,
    environment,
    capabilities,
    pricing,
    storage: assetStorage,
    heartbeats: createMongoServiceHeartbeatRepository(database),
  });
  if (generationEnabled) {
    readinessDependencies.push({
      name: "generation-runtime",
      check: async () => {
        const availability = await generationAvailability.evaluate();
        if (availability.status !== "ready") throw new Error(availability.reason ?? "unavailable");
      },
    });
  }
  return {
    guestAccess: storageGuestAccess,
    templatePreviewStorage: storage,
    authGateway,
    creatorRepository,
    guestClaimService,
    sourceScanner,
    requestRateLimiter,
    assetRepository: createMongoAssetRepository(database),
    assetStorage,
    remoteImageFetcher,
    ...(generationService ? { generationService } : {}),
    generationAvailability,
    capabilityRegistry: capabilities,
    readinessDependencies,
    close: () => database.close(),
  };
}
