import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminOwnedMediaImportSchema } from "@movprompt/contracts";
import { adminApi } from "./api";
import { object, type RecordData } from "./adminData";
import { ErrorState, Loading } from "./AdminDisplay";

export function OwnedMediaImport({
  id,
  current,
}: {
  id?: string;
  current?: RecordData;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(String(current?.kind ?? "product-sample"));
  const [name, setName] = useState(String(current?.name ?? ""));
  const [source, setSource] = useState("");
  const [rights, setRights] = useState(false);
  const [adult, setAdult] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const command = useRef({ key: crypto.randomUUID(), hash: "" });
  const query = useQuery({
    queryKey: ["admin", "owned-media-sources"],
    queryFn: () => adminApi.get("owned-media/sources"),
    enabled: open,
  });
  const client = useQueryClient();
  const navigate = useNavigate();
  const choices = (Array.isArray(query.data?.items) ? query.data.items : [])
    .map(object)
    .filter((item) =>
      kind === "video-preview"
        ? item.type === "generation"
        : item.type === "library" &&
          (kind === "presenter-sample") === (item.kind === "presenter"),
    );
  return (
    <>
      <Button
        variant={id ? "outline" : "default"}
        onClick={() => setOpen(true)}
      >
        {id
          ? t("Replace media", "استبدال الوسائط")
          : t("Import company media", "استيراد وسائط الشركة")}
      </Button>
      <Dialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
          dir={ar ? "rtl" : "ltr"}
        >
          <DialogHeader>
            <DialogTitle>
              {t("Independent MovPrompt media", "وسائط MovPrompt مستقلة")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Choose approved photos or completed footage owned by this account. An independent private copy is verified before review. Customer media is never imported automatically. Photos are limited to 12 MB and preview videos to 64 MB.",
                "اختر صوراً معتمدة أو فيديو مكتملاً يملكه هذا الحساب. يتم التحقق من نسخة خاصة مستقلة قبل المراجعة. لا يتم استيراد وسائط العملاء تلقائياً. الحد الأقصى للصورة ١٢ ميغابايت وللفيديو ٦٤ ميغابايت.",
              )}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              if (pending) return;
              setPending(true);
              setError("");
              try {
                const selected = choices.find((item) => item.key === source);
                if (!selected)
                  throw new Error(
                    t("Choose a source first.", "اختر مصدراً أولاً."),
                  );
                const body = AdminOwnedMediaImportSchema.parse({
                  expectedRevision: Number(current?.revision ?? 0),
                  expectedStateRevision: Number(current?.stateRevision ?? 0),
                  name,
                  kind,
                  source: selected.source,
                  rightsConfirmed: rights,
                  adultLikenessConfirmed: adult,
                  reason,
                });
                const hash = JSON.stringify(body);
                if (command.current.hash && command.current.hash !== hash)
                  command.current.key = crypto.randomUUID();
                command.current.hash = hash;
                const result = await adminApi.mutate(
                  id ? `owned-media/${id}/replace` : "owned-media",
                  body,
                  command.current.key,
                );
                await client.invalidateQueries({ queryKey: ["admin"] });
                setOpen(false);
                navigate(`/admin/owned-media/${result.id}`);
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : t("Import failed", "تعذر الاستيراد"),
                );
              } finally {
                setPending(false);
              }
            }}
          >
            <label className="grid gap-2 text-sm">
              {t("Media name", "اسم الوسائط")}
              <Input
                value={name}
                maxLength={160}
                required
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              {t("Use", "الاستخدام")}
              <select
                className="admin-select"
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value);
                  setSource("");
                  setAdult(false);
                }}
              >
                {[
                  ["product-sample", "Product sample", "عينة منتج"],
                  ["presenter-sample", "Presenter sample", "عينة شخصية"],
                  ["poster", "Poster image", "صورة المعاينة"],
                  ["video-preview", "Video preview", "معاينة فيديو"],
                ].map(([value, en, arabic]) => (
                  <option key={value} value={value}>
                    {t(en!, arabic!)}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="space-y-3">
              <legend className="mb-3 text-sm font-medium">
                {t("Approved source", "المصدر المعتمد")}
              </legend>
              {query.isPending ? (
                <Loading />
              ) : query.error ? (
                <ErrorState
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              ) : choices.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {choices.map((item) => (
                    <label
                      key={String(item.key)}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${source === item.key ? "border-primary bg-primary/5" : ""}`}
                    >
                      <input
                        type="radio"
                        name="owned-source"
                        value={String(item.key)}
                        checked={source === item.key}
                        onChange={() => {
                          setSource(String(item.key));
                          if (!name) setName(String(item.name));
                        }}
                      />
                      {item.type === "library" && (
                        <img
                          alt=""
                          className="h-12 w-12 rounded object-cover"
                          src={adminApi.media(
                            "asset",
                            String(object(item.source).entryId),
                            String(object(item.source).photoId),
                          )}
                        />
                      )}
                      <span className="min-w-0 break-words text-sm">
                        {String(item.name)}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                  {t(
                    "No approved sources yet. Upload and approve company photos in My assets, or generate owner footage before importing.",
                    "لا توجد مصادر معتمدة بعد. ارفع صور الشركة واعتمدها في أصولي أو أنشئ فيديو بحساب المالك قبل الاستيراد.",
                  )}
                </p>
              )}
            </fieldset>
            <label className="flex items-start gap-3 text-sm leading-6">
              <input
                className="mt-1.5"
                type="checkbox"
                checked={rights}
                onChange={(event) => setRights(event.target.checked)}
              />
              {t(
                "I confirm MovPrompt has permission to use this media as a company sample or preview.",
                "أؤكد أن MovPrompt تملك إذناً لاستخدام هذه الوسائط كعينة أو معاينة للشركة.",
              )}
            </label>
            {kind === "presenter-sample" && (
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  className="mt-1.5"
                  type="checkbox"
                  checked={adult}
                  onChange={(event) => setAdult(event.target.checked)}
                />
                {t(
                  "This is the same adult presenter and their likeness permission covers this use.",
                  "هذه الشخصية لشخص بالغ واحد ويغطي إذن استخدام المظهر هذا الاستخدام.",
                )}
              </label>
            )}
            <label className="grid gap-2 text-sm">
              {t("Reason for review", "سبب المراجعة")}
              <Textarea
                value={reason}
                minLength={8}
                maxLength={1000}
                required
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              disabled={
                pending ||
                !rights ||
                !source ||
                !name.trim() ||
                reason.trim().length < 8 ||
                (kind === "presenter-sample" && !adult)
              }
              type="submit"
            >
              {pending
                ? t("Queuing copy…", "جارٍ إضافة النسخ…")
                : t("Copy for owner review", "نسخ لمراجعة المالك")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
