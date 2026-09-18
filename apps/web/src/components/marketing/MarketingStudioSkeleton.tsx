import { Skeleton } from "@/components/ui/skeleton";

export const MarketingStudioSkeleton = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-12">
        {/* Title */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <Skeleton className="h-10 w-[420px] max-w-full" />
          <Skeleton className="h-10 w-[360px] max-w-full" />
          <Skeleton className="h-4 w-[480px] max-w-full mt-2" />
        </div>

        {/* Composer card */}
        <div className="flex gap-4">
          <Skeleton className="h-[112px] w-[112px] rounded-2xl shrink-0 hidden md:block" />
          <div className="flex-1 rounded-2xl border border-border/40 bg-card/30 p-5 space-y-4">
            <div className="flex gap-3">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
              </div>
              <Skeleton className="h-9 w-40 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Featured row */}
        <div className="mt-14">
          <div className="flex items-end justify-between mb-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-9 w-72 rounded-full hidden md:block" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
            <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
            <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
};
