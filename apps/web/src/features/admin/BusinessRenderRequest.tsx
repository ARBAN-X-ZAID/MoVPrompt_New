import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { adminApi } from "./api";
import { object } from "./adminData";
import { useAdminCommandKey } from "./useAdminCommandKey";
export function BusinessRenderRequest({
  templateId,
  draftRevision,
  sourceVersionId,
  originalRunId,
  ar,
}: {
  templateId?: string;
  draftRevision?: number;
  sourceVersionId?: string;
  originalRunId?: string;
  ar: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(sourceVersionId ?? "");
  const [rights, setRights] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const preview = Boolean(templateId);
  const key = useAdminCommandKey();
  const client = useQueryClient();
  const navigate = useNavigate();
  const status = useQuery({
    queryKey: ["admin", "business-render-status"],
    queryFn: () => adminApi.get("business-renders/status"),
    enabled: open,
  });
  const sources = useQuery({
    queryKey: ["admin", "business-sources", templateId],
    queryFn: () =>
      adminApi.get(`business-renders/sources?templateId=${templateId}`),
    enabled: open && preview,
  });
  const choices = (
    Array.isArray(sources.data?.items) ? sources.data.items : []
  ).map(object);
  return (
    <>
      <Button
        variant="outline"
        disabled={preview && !draftRevision}
        onClick={() => setOpen(true)}
      >
        {ar
          ? preview
            ? "تحضير معاينة بميزانية الشركة"
            : "طلب فيديو بديل بميزانية الشركة"
          : preview
            ? "Prepare business-funded preview"
            : "Request business-funded replacement"}
      </Button>
      <Dialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
        <DialogContent
          dir={ar ? "rtl" : "ltr"}
          className="max-h-[90dvh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              {ar
                ? "طلب ومراجعة منفصلان للتوليد"
                : "Separate render request and review"}
            </DialogTitle>
            <DialogDescription>
              {ar
                ? "يحتفظ الطلب بالحقائق والرسائل والكلام المعتمد. لا يتم خصم رصيد العميل أو تغيير نسخته المعتمدة. الموافقة على الإنفاق تتم بعد تحضير الطلب."
                : "The request preserves facts, display messages and approved speech. It does not charge customer credits or change their accepted version. Spending approval follows preparation."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError("");
              try {
                const body = {
                  purpose: preview ? "preview" : "recovery",
                  sourceVersionId: selected,
                  ...(templateId ? { templateId, draftRevision } : {}),
                  ...(originalRunId ? { originalRunId } : {}),
                  publicPreviewPermissionConfirmed: preview && rights,
                  reason,
                };
                const result = await adminApi.mutate(
                  "business-renders",
                  body,
                  key(body),
                );
                await client.invalidateQueries({ queryKey: ["admin"] });
                setOpen(false);
                navigate(`/admin/business-renders/${result.id}`);
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Preparation failed",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {preview ? (
              <label className="grid gap-2 text-sm">
                {ar ? "حملة الشركة المرجعية" : "Company reference campaign"}
                <select
                  required
                  className="admin-select"
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <option value="">
                    {ar
                      ? "اختر نسخة محفوظة من حملاتك"
                      : "Choose one of your saved campaign versions"}
                  </option>
                  {choices.map((item) => (
                    <option key={String(item.id)} value={String(item.id)}>
                      {String(item.name)}
                    </option>
                  ))}
                </select>
                {sources.error && (
                  <span role="alert">{sources.error.message}</span>
                )}
              </label>
            ) : (
              <p className="break-words text-xs text-muted-foreground">
                {ar ? "النسخة المصدرية" : "Source version"}: {selected}
              </p>
            )}
            {preview && (
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  required
                  checked={rights}
                  className="mt-1 h-5 w-5"
                  onChange={(event) => setRights(event.target.checked)}
                />
                <span>
                  {ar
                    ? "هذه مراجع الشركة المملوكة لحسابي وأجيز استخدامها في معاينة عامة، بما يشمل حقوق الصور والشخصيات والكلام المعتمد."
                    : "These are company references owned by my account. I approve public preview use, including image, likeness and approved speech rights."}
                </span>
              </label>
            )}
            <p className="rounded border p-3 text-sm">
              {ar
                ? "تستخدم الميزانية سقف تكلفة تقديرياً بالدولار يشمل محاولات الجودة. تبقى التكاليف الفعلية غير مؤكدة حتى يبلغ عنها المزود. لا يتم تحويلها إلى الدينار."
                : "The budget uses a configured USD cost ceiling including quality retries. Actual costs remain unconfirmed until reported by the provider. No KWD conversion is assumed."}
            </p>
            {status.data?.enabled !== true && (
              <p className="text-sm text-muted-foreground">
                {ar
                  ? "تنفيذ التوليد المدفوع مغلق حتى اعتماد ميزانية المالك وقبول تكلفة المزود. يمكن تحضير الطلب عندما تتوفر سياسة تكلفة موثقة."
                  : "Paid execution is gated until owner-budget and provider-cost acceptance. Preparation is available when the cost policy is configured."}
              </p>
            )}
            <label className="grid gap-2 text-sm">
              {ar ? "سبب الطلب" : "Request reason"}
              <Textarea
                required
                minLength={8}
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Button
              disabled={
                pending ||
                !selected ||
                reason.trim().length < 8 ||
                !status.data?.perAttemptCeilingMicrousd ||
                (preview && !rights)
              }
            >
              {pending
                ? ar
                  ? "جارٍ التحضير…"
                  : "Preparing…"
                : ar
                  ? "تحضير الطلب للمراجعة"
                  : "Prepare request for review"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
