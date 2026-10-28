import { useQuery } from "@tanstack/react-query";
import { PublicPricingSnapshotSchema } from "@movprompt/contracts";
import { request } from "@/lib/api/portableApiClient";
import { isFeatureEnabled } from "@/config/features";
import { VIDEO_LENGTH_CREDIT_PRICES } from "./generationPrices";
export function usePublicPricing(enabled = true) {
  const portable = isFeatureEnabled("portableAuth");
  const query = useQuery({
    queryKey: ["public-pricing"],
    queryFn: () => request("/api/v1/pricing", PublicPricingSnapshotSchema),
    enabled: enabled && portable,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const rows = portable
    ? (query.data?.video
        .filter(
          (row) => row.product === "template" && row.resolution === "720p",
        )
        .map((row) => ({
          seconds: row.durationSeconds,
          credits: row.credits,
        })) ?? [])
    : VIDEO_LENGTH_CREDIT_PRICES;
  const adHd = query.data?.video.find(
    (row) =>
      row.product === "ad_studio" &&
      row.durationSeconds === 8 &&
      row.resolution === "720p",
  )?.credits;
  const adSd = query.data?.video.find(
    (row) =>
      row.product === "ad_studio" &&
      row.durationSeconds === 8 &&
      row.resolution === "480p",
  )?.credits;
  return {
    ...query,
    rows,
    adHdSurcharge: adHd != null && adSd != null ? adHd - adSd : null,
  };
}
