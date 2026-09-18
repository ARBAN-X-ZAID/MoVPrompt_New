// Future seam for plugging in real video generation providers.
// All implementations currently return "coming_soon" — wiring is intentional
// so we can drop in API keys later without refactoring callers.

export type VideoJob = {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "coming_soon";
  url?: string;
  error?: string;
};

export type VideoGenInput = {
  prompt: string;
  references?: string[]; // image URLs
  durationSec?: 5 | 10;
  aspect?: "16:9" | "9:16" | "1:1";
};

export interface VideoProvider {
  id: "seedance" | "veo" | "kling";
  generate(input: VideoGenInput): Promise<VideoJob>;
}

const stub = (id: VideoProvider["id"]): VideoProvider => ({
  id,
  async generate() {
    return { id: "stub", status: "coming_soon" };
  },
});

export const seedance = stub("seedance");
export const veo = stub("veo");
export const kling = stub("kling");

export const videoProviders: Record<VideoProvider["id"], VideoProvider> = {
  seedance,
  veo,
  kling,
};
