import type { JsonObject } from "@movprompt/db";

/** Optional processing interface; no separate speech provider is configured in the R2/Gateway stack. */
export interface CampaignVoiceRenderer {
  render(configuration: JsonObject): Promise<Uint8Array | undefined>;
}
