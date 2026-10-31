import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePasswordCooldown } from "@/lib/auth/usePasswordCooldown";
import { adminApi } from "./api";

export function RefundDialog({
  userId,
  source,
  kind,
  ar,
  onClose,
}: {
  userId: string;
  source: Record<string, unknown>;
  kind: "cash-refund" | "generation-restoration" | "credit-adjustment";
  ar: boolean;
  onClose: () => void;
}) {
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [amount, setAmount] = useState(
    (Number(source.amountMinor ?? 0) / 1000).toFixed(3),
  );
  const [credits, setCredits] = useState("1");
  const [direction, setDirection] = useState<"add" | "deduct">("add");
  const adjusting = kind === "credit-adjustment";
  const [reason, setReason] = useState("");
  const [exception, setException] = useState(false);
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const keys = useRef({
    request: crypto.randomUUID(),
    review: crypto.randomUUID(),
    id: "",
    revision: 1,
  });
  const client = useQueryClient();
  const cooldown = usePasswordCooldown();
  const body = {
    kind,
    userId,
    reason,
    ...(kind === "cash-refund"
      ? {
          orderId: source.id,
          amountMinor: Math.round(Number(amount) * 1000),
          exception,
        }
      : adjusting
        ? { delta: Number(credits) * (direction === "add" ? 1 : -1) }
        : { runId: source.id }),
  };
  function changed() {
    setPreview(null);
    keys.current = {
      request: crypto.randomUUID(),
      review: crypto.randomUUID(),
      id: "",
      revision: 1,
    };
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent
        dir={ar ? "rtl" : "ltr"}
        closeLabel={t("Close", "إغلاق")}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <DialogTitle>
          {adjusting ? t("Adjust credits", "تعديل الرصيد") : kind === "cash-refund"
            ? t("Refund purchase", "استرداد قيمة الشراء")
            : t("Restore generation credits", "استعادة رصيد التوليد")}
        </DialogTitle>
        <DialogDescription>
          {t(
            "Review the balance impact before confirming. Eligibility and active reservations are checked again on approval.",
            "راجع الأثر قبل التأكيد. تُراجع الاستردادات السابقة والحجوزات النشطة عند الموافقة.",
          )}
        </DialogDescription>
        {done ? (
          <>
            <p role="status">
              {t(
                adjusting ? "Credit adjustment completed. The updated balance and transaction appear in the customer wallet." : "Request approved. Its processing status appears in the customer wallet.",
                adjusting ? "تم تعديل الرصيد. يظهر الرصيد المحدّث والمعاملة في محفظة العميل." : "تمت الموافقة على الطلب. تظهر حالة المعالجة في محفظة العميل.",
              )}
            </p>
            <Button onClick={onClose}>{t("Close", "إغلاق")}</Button>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (pending || cooldown.seconds) return;
              setPending(true);
              setError("");
              try {
                if (!preview) {
                  setPreview(
                    await adminApi.mutate(
                      "finance/preview",
                      body,
                      keys.current.request,
                    ),
                  );
                } else {
                  await adminApi.confirmPassword(password);
                  setPassword("");
                  if (!keys.current.id) {
                    const request = await adminApi.mutate(
                      "finance/requests",
                      body,
                      keys.current.request,
                    );
                    keys.current.id = String(request.id);
                    keys.current.revision = Number(request.revision);
                  }
                  await adminApi.mutate(
                    `finance/requests/${keys.current.id}/review`,
                    {
                      expectedRevision: keys.current.revision,
                      decision: "approve",
                      reason,
                    },
                    keys.current.review,
                  );
                  await client.invalidateQueries({ queryKey: ["admin"] });
                  setDone(true);
                }
              } catch (failure) {
                cooldown.capture(failure);
                setError(
                  failure instanceof Error
                    ? failure.message
                    : t("Wallet action failed", "تعذر تحديث المحفظة"),
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {adjusting && (
              <div className="grid grid-cols-2 gap-4">
                <label className="admin-field">
                  {t("Action", "الإجراء")}
                  <select className="h-10 rounded-md border bg-background px-3 text-sm" value={direction} disabled={pending || Boolean(keys.current.id)} onChange={(event) => { setDirection(event.target.value as "add" | "deduct"); changed(); }}>
                    <option value="add">{t("Add credits", "إضافة رصيد")}</option>
                    <option value="deduct">{t("Deduct credits", "خصم رصيد")}</option>
                  </select>
                </label>
                <label className="admin-field">
                  {t("Credits", "الرصيد")}
                  <Input type="number" min="1" max="100000" step="1" required value={credits} disabled={pending || Boolean(keys.current.id)} onChange={(event) => { setCredits(event.target.value); changed(); }} />
                </label>
              </div>
            )}
            {kind === "cash-refund" && (
              <>
                <label className="admin-field">
                  {t("Amount (KWD)", "المبلغ (د.ك)")}
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    max={Number(source.amountMinor) / 1000}
                    required
                    value={amount}
                    disabled={pending || Boolean(keys.current.id)}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      changed();
                    }}
                  />
                </label>
                <label className="flex gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={exception}
                    disabled={pending || Boolean(keys.current.id)}
                    onChange={(event) => {
                      setException(event.target.checked);
                      changed();
                    }}
                  />
                  {t(
                    "Owner exception for already-used purchase value",
                    "استثناء المالك لقيمة شراء مستخدمة",
                  )}
                </label>
              </>
            )}
            <label className="admin-field">
              {t("Reason", "السبب")}
              <Textarea
                value={reason}
                required
                minLength={8}
                disabled={pending || Boolean(keys.current.id)}
                onChange={(event) => {
                  setReason(event.target.value);
                  changed();
                }}
              />
            </label>
            {preview && (
              <section className="rounded-xl border bg-muted/30 p-4 space-y-2">
                <h3 className="font-medium">
                  {adjusting ? t("Balance review", "مراجعة الرصيد") : t("Refund review", "مراجعة الاسترداد")}
                </h3>
                {(adjusting
                  ? [
                      ["balance", t("Current balance", "الرصيد الحالي")],
                      ["available", t("Available credits", "الرصيد المتاح")],
                      ["delta", t("Credit change", "تغيير الرصيد")],
                      ["balanceAfter", t("Balance after adjustment", "الرصيد بعد التعديل")],
                    ]
                  : kind === "cash-refund"
                  ? [
                      [
                        "priorRefundsMinor",
                        t("Previously refunded (KWD)", "المسترد سابقاً (د.ك)"),
                      ],
                      [
                        "remainingRefundableMinor",
                        t(
                          "Refundable amount (KWD)",
                          "القيمة القابلة للاسترداد (د.ك)",
                        ),
                      ],
                      [
                        "creditsToRetire",
                        t("Credits removed", "الرصيد المخصوم"),
                      ],
                      [
                        "balanceAfter",
                        t("Balance after refund", "الرصيد بعد الاسترداد"),
                      ],
                    ]
                  : [
                      [
                        "chargedCredits",
                        t("Credits to restore", "الرصيد المستعاد"),
                      ],
                    ]
                ).map(([key, label]) => (
                  <div className="flex justify-between gap-4 text-sm" key={key}>
                    <span>{label}</span>
                    <strong>
                      {key.endsWith("Minor")
                        ? (Number(preview[key]) / 1000).toFixed(3)
                        : String(preview[key] ?? 0)}
                    </strong>
                  </div>
                ))}
                {kind === "cash-refund" && (!preview.executionEnabled || !preview.gatewayReady) && (
                  <p role="status" className="text-sm">
                    {t(
                      "Cash-refund approval is unavailable until gateway verification is complete. No money will be transferred.",
                      "الموافقة على الاسترداد النقدي غير متاحة حتى اكتمال التحقق من بوابة الدفع. لن يتم تحويل أموال.",
                    )}
                  </p>
                )}
              </section>
            )}
            {preview && (
              <label className="admin-field">
                {t("Confirm your password", "تأكيد كلمة المرور")}
                <Input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {cooldown.seconds > 0 && (
              <p role="status">
                {t(
                  `Try again in ${cooldown.seconds} seconds`,
                  `حاول بعد ${cooldown.seconds} ثانية`,
                )}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={onClose}
              >
                {t("Cancel", "إلغاء")}
              </Button>
              <Button
                disabled={
                  pending ||
                  cooldown.seconds > 0 ||
                  Boolean(
                    preview &&
                    kind === "cash-refund" &&
                    (!preview.executionEnabled || !preview.gatewayReady),
                  )
                }
              >
                {pending
                  ? t("Checking…", "جارٍ التحقق…")
                  : preview
                    ? adjusting ? t("Confirm adjustment", "تأكيد التعديل") : t("Confirm refund", "تأكيد الاسترداد")
                    : adjusting ? t("Review adjustment", "مراجعة التعديل") : t("Review refund", "مراجعة الاسترداد")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
