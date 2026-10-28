import { useAdminCommandKey } from "./useAdminCommandKey";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminPricingPolicySchema,
  type AdminPricingPolicy,
} from "@movprompt/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";
import { ErrorState, Loading } from "./AdminDisplay";

function PricingEditor({ data }: { data: Record<string, unknown> }) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const draft = data.draft as Record<string, unknown> | null;
  const [policy, setPolicy] = useState<AdminPricingPolicy>(() =>
    AdminPricingPolicySchema.parse(draft?.policy ?? data.policy),
  );
  const commandKey = useAdminCommandKey();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const client = useQueryClient();
  const impact = data.impact as {
    packageChanges: Array<{
      id: string;
      before: { credits: number; amountMinor: number } | null;
      after: { credits: number; amountMinor: number } | null;
    }>;
    rows: Array<{
      product: string;
      durationSeconds: number;
      resolution: string;
      previousCredits: number | null;
      nextCredits: number;
    }>;
    impactHash: string;
  };
  const field = (
    id: string,
    label: string,
    value: number,
    onChange: (value: number) => void,
    min = 0,
  ) => (
    <label key={id} className="grid gap-2 text-sm" htmlFor={id}>
      {label}
      <Input
        id={id}
        type="number"
        min={min}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
  async function submit(publish: boolean) {
    setPending(true);
    setError("");
    try {
      const parsed = AdminPricingPolicySchema.parse(policy);
      await adminApi.mutate(
        publish ? "pricing/publish" : "pricing/draft",
        publish
          ? {
              expectedRevision: Number(data.headRevision),
              draftRevision: Number(draft?.revision),
              impactHash: impact.impactHash,
              reason,
            }
          : {
              expectedRevision: Number(draft?.revision ?? 0),
              policy: parsed,
              reason,
            },
        commandKey({
          publish,
          policy,
          reason,
          revision: draft?.revision,
          impact: data.impact,
        }),
      );
      await client.invalidateQueries({ queryKey: ["admin", "pricing"] });
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Pricing update failed",
      );
    } finally {
      setPending(false);
    }
  }
  const dirty =
    JSON.stringify(policy) !== JSON.stringify(draft?.policy ?? data.policy);
  return (
    <div className="space-y-6">
      <section className="admin-panel space-y-5">
        <h2 className="font-semibold">
          {t("Generation prices", "أسعار إنشاء الفيديو")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "Amounts are credits. Save a draft, review the recalculated impact, then approve publication. Existing quotes and purchases retain their original snapshots.",
            "القيم بالرصيد. احفظ المسودة وراجع الأثر المحسوب ثم اعتمد النشر. تحتفظ العروض والمشتريات الحالية بلقطاتها الأصلية.",
          )}
        </p>
        {(["template", "ad_studio", "advanced"] as const).map((product) => (
          <fieldset className="rounded-xl border p-4" key={product}>
            <legend className="px-2 text-sm font-medium">
              {product === "template"
                ? t("Templates", "القوالب")
                : product === "ad_studio"
                  ? t("Adstudio", "استوديو الإعلانات")
                  : t("Advanced", "المتقدم")}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["eightSeconds", "8s"],
                  ["fifteenSeconds", "15s"],
                  ["twentySeconds", "20s"],
                  ["hdSurcharge", t("720p extra", "إضافة 720p")],
                ] as const
              ).map(([key, label]) =>
                field(
                  `price-${product}-${key}`,
                  label,
                  policy.video[product][key],
                  (value) =>
                    setPolicy((current) => ({
                      ...current,
                      video: {
                        ...current.video,
                        [product]: { ...current.video[product], [key]: value },
                      },
                    })),
                  key === "hdSurcharge" ? 0 : 1,
                ),
              )}
            </div>
          </fieldset>
        ))}
      </section>
      <section className="admin-panel space-y-5">
        <h2 className="font-semibold">
          {t("Credit packages", "باقات الرصيد")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t(
            "KWD amounts are integer fils. 1 KWD = 1,000 fils.",
            "تُدخل مبالغ الدينار بفلس صحيح. ١ دينار = ١٠٠٠ فلس.",
          )}
        </p>
        {policy.packages.map((item, index) => (
          <fieldset key={index} className="rounded-xl border p-4">
            <legend className="px-2 text-sm">{item.id}</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm">
                {t("Package ID", "معرّف الباقة")}
                <Input
                  value={item.id}
                  onChange={(event) =>
                    setPolicy((current) => ({
                      ...current,
                      packages: current.packages.map((p, i) =>
                        i === index ? { ...p, id: event.target.value } : p,
                      ),
                    }))
                  }
                />
              </label>
              {field(
                `package-${index}-credits`,
                t("Credits", "الرصيد"),
                item.credits,
                (value) =>
                  setPolicy((current) => ({
                    ...current,
                    packages: current.packages.map((p, i) =>
                      i === index ? { ...p, credits: value } : p,
                    ),
                  })),
                1,
              )}
              {field(
                `package-${index}-amount`,
                t("Price in fils", "السعر بالفلس"),
                item.amountMinor,
                (value) =>
                  setPolicy((current) => ({
                    ...current,
                    packages: current.packages.map((p, i) =>
                      i === index ? { ...p, amountMinor: value } : p,
                    ),
                  })),
                1,
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.popular}
                  onChange={(event) =>
                    setPolicy((current) => ({
                      ...current,
                      packages: current.packages.map((p, i) =>
                        i === index
                          ? { ...p, popular: event.target.checked }
                          : p,
                      ),
                    }))
                  }
                />
                {t("Popular", "مميزة")}
              </label>
              <Button
                variant="ghost"
                size="sm"
                disabled={policy.packages.length === 1}
                onClick={() =>
                  setPolicy((current) => ({
                    ...current,
                    packages: current.packages.filter((_, i) => i !== index),
                  }))
                }
              >
                {t("Remove package", "إزالة الباقة")}
              </Button>
            </div>
          </fieldset>
        ))}
        <Button
          variant="outline"
          disabled={policy.packages.length >= 20}
          onClick={() =>
            setPolicy((current) => ({
              ...current,
              packages: [
                ...current.packages,
                {
                  id: `credits-new-${current.packages.length + 1}`,
                  credits: 100,
                  amountMinor: 5000,
                  currency: "KWD",
                  popular: false,
                },
              ],
            }))
          }
        >
          {t("Add package", "إضافة باقة")}
        </Button>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["min", t("Custom minimum credits", "الحد الأدنى للشحن المخصص")],
              ["max", t("Custom maximum credits", "الحد الأقصى للشحن المخصص")],
              [
                "amountMinorPerCredit",
                t("Fils per custom credit", "فلس لكل رصيد مخصص"),
              ],
            ] as const
          ).map(([key, label]) =>
            field(
              `custom-${key}`,
              label,
              policy.customTopUp[key],
              (value) =>
                setPolicy((current) => ({
                  ...current,
                  customTopUp: { ...current.customTopUp, [key]: value },
                })),
              1,
            ),
          )}
        </div>
      </section>
      <section className="admin-panel space-y-4">
        <h2 className="font-semibold">
          {t("Entitlement policy", "سياسة الاستحقاق")}
        </h2>
        {(
          [
            [
              "starterOnly",
              t("Starter-only beta", "تجربة محدودة للفيديو الأول"),
            ],
            [
              "starterRenders",
              t(
                "Allow existing starter entitlements",
                "السماح باستحقاقات الفيديو الأول الحالية",
              ),
            ],
            [
              "freeAccounts",
              t(
                "Waive generation charges for signed-in accounts",
                "إعفاء الحسابات المسجلة من رسوم التوليد",
              ),
            ],
          ] as const
        ).map(([key, label]) => (
          <label className="flex items-center gap-2 text-sm" key={key}>
            <input
              type="checkbox"
              checked={policy.entitlements[key]}
              onChange={(event) =>
                setPolicy((current) => ({
                  ...current,
                  entitlements: {
                    ...current.entitlements,
                    [key]: event.target.checked,
                  },
                }))
              }
            />
            {label}
          </label>
        ))}
        <p className="text-xs text-muted-foreground">
          {t(
            "This does not create or restore wallet credits. Entitlements already consumed are not reset.",
            "لا ينشئ هذا رصيداً في المحفظة أو يعيده. لا تُعاد الاستحقاقات المستخدمة.",
          )}
        </p>
        {field(
          "quote-ttl",
          t("Quote validity (seconds)", "صلاحية عرض السعر بالثواني"),
          policy.quoteTtlSeconds,
          (value) =>
            setPolicy((current) => ({ ...current, quoteTtlSeconds: value })),
          60,
        )}
      </section>
      <section className="admin-panel space-y-4">
        <h2 className="font-semibold">{t("Owner review", "مراجعة المالك")}</h2>
        <label className="grid gap-2 text-sm">
          {t("Reason for the change", "سبب التغيير")}
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <Button
          disabled={pending || reason.trim().length < 8}
          onClick={() => void submit(false)}
        >
          {t("Save draft and calculate impact", "حفظ المسودة وحساب الأثر")}
        </Button>
        {draft?.status === "draft" && (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              {impact.rows.map((row) => (
                <div
                  className="rounded border p-3 text-xs"
                  key={`${row.product}/${row.durationSeconds}/${row.resolution}`}
                >
                  <span>
                    {row.product} · {row.durationSeconds}s · {row.resolution}
                  </span>
                  <strong className="ms-3">
                    {row.previousCredits ?? t("Unavailable", "غير متوفر")} →{" "}
                    {row.nextCredits}
                  </strong>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {impact.packageChanges.map((change) => (
                <div key={change.id} className="rounded border p-3 text-sm">
                  <strong>{change.id}</strong>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {change.before
                      ? `${change.before.credits} ${t("credits", "رصيد")} / ${change.before.amountMinor} ${t("fils", "فلس")}`
                      : t("New package", "باقة جديدة")}{" "}
                    →{" "}
                    {change.after
                      ? `${change.after.credits} ${t("credits", "رصيد")} / ${change.after.amountMinor} ${t("fils", "فلس")}`
                      : t(
                          "Removed from new purchases",
                          "أزيلت من المشتريات الجديدة",
                        )}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {t(
                "Publication changes new purchases and quotes only. Pending orders, balances, reserved runs and completed videos are unchanged.",
                "يغيّر النشر المشتريات وعروض الأسعار الجديدة فقط. تبقى الطلبات المعلقة والأرصدة والفيديوهات الحالية كما هي.",
              )}
            </p>
            <Button
              disabled={
                pending ||
                dirty ||
                reason.trim().length < 8 ||
                data.publishingEnabled !== true
              }
              onClick={() => void submit(true)}
            >
              {t(
                "Approve and publish reviewed prices",
                "اعتماد ونشر الأسعار بعد المراجعة",
              )}
            </Button>
          </>
        )}
        {data.publishingEnabled !== true && (
          <p className="text-sm text-muted-foreground">
            {t(
              "Price publication remains disabled until rollout approval.",
              "يبقى نشر الأسعار معطلاً حتى اعتماد الإطلاق.",
            )}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
export default function AdminPricing() {
  const query = useQuery({
    queryKey: ["admin", "pricing"],
    queryFn: () => adminApi.get("pricing"),
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <PricingEditor
      key={`${query.data.headRevision}/${(query.data.draft as Record<string, unknown> | null)?.revision ?? 0}`}
      data={query.data}
    />
  );
}
