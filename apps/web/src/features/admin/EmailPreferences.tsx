import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { request } from "@/lib/api/portableApiClient";
import { Button } from "@/components/ui/button";
const Schema = z.object({
  marketingOptIn: z.boolean(),
  revision: z.number().int(),
  suppressed: z.boolean(),
});
export function EmailPreferences({ ar }: { ar: boolean }) {
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ["email-preferences"],
    queryFn: () => request("/api/v1/notification-preferences", Schema),
  });
  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <h2 className="font-medium">
        {ar ? "تفضيلات البريد" : "Email preferences"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "رسائل العروض اختيارية. تبقى رسائل الحساب والدعم متاحة عند إلغاء الاشتراك."
          : "Promotional emails are optional. Account and support emails remain available when you unsubscribe."}
      </p>
      {query.isPending ? (
        <p role="status">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
      ) : query.error ? (
        <p role="alert">{query.error.message}</p>
      ) : (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={query.data.marketingOptIn}
            disabled={pending}
            onChange={async (event) => {
              const marketingOptIn = event.target.checked;
              setPending(true);
              setError("");
              try {
                await request("/api/v1/notification-preferences", Schema, {
                  method: "POST",
                  body: {
                    expectedRevision: query.data.revision,
                    marketingOptIn,
                  },
                  idempotencyKey: crypto.randomUUID(),
                });
                await client.invalidateQueries({
                  queryKey: ["email-preferences"],
                });
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Preference update failed",
                );
              } finally {
                setPending(false);
              }
            }}
          />
          <span>
            {ar
              ? "أوافق على استلام رسائل MovPrompt الترويجية."
              : "I agree to receive promotional emails from MovPrompt."}
          </span>
        </label>
      )}
      {pending && <p role="status">{ar ? "جارٍ الحفظ…" : "Saving…"}</p>}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {query.error && (
        <Button variant="outline" onClick={() => void query.refetch()}>
          {ar ? "إعادة المحاولة" : "Retry"}
        </Button>
      )}
    </section>
  );
}
