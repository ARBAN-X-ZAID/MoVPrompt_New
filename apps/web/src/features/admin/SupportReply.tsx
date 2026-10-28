import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { request, apiOrigin } from "@/lib/api/portableApiClient";
import { adminApi } from "./api";

const Receipt = z.object({
  id: z.string(),
  upload: z.object({
    url: z.string(),
    headers: z.record(z.string(), z.string()),
  }),
});
type Photo = { id: string; name: string };
export function SupportAttachments({
  attachments,
  caseId,
  admin = false,
  ar = false,
}: {
  attachments: unknown;
  caseId: string;
  admin?: boolean;
  ar?: boolean;
}) {
  if (!Array.isArray(attachments)) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-3">
      {attachments.map((value) => {
        const photo = z
          .object({ id: z.string().regex(/^[a-f0-9]{24}$/i), name: z.string() })
          .safeParse(value);
        if (!photo.success) return null;
        return (
          <li key={photo.data.id}>
            <a
              className="inline-flex min-h-11 items-center rounded border px-3 text-sm text-primary underline"
              href={`${apiOrigin()}/api/v1/${admin ? "admin/" : ""}support/${caseId}/attachments/${photo.data.id}`}
              download
            >
              {ar ? "تنزيل" : "Download"} {photo.data.name}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
export function SupportReply({
  caseId,
  revision,
  admin = false,
  ar,
  onClose,
}: {
  caseId: string;
  revision: number;
  admin?: boolean;
  ar: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [retryFiles, setRetryFiles] = useState<File[]>([]);
  const command = useRef({ hash: "", key: crypto.randomUUID() });
  const base = `/api/v1/${admin ? "admin/" : ""}support/${caseId}`;
  async function upload(files: File[]) {
    setUploading(true);
    setError("");
    setRetryFiles([]);
    const remaining = files.slice(0, 3 - photos.length);
    for (let index = 0; index < remaining.length; index++) {
      const file = remaining[index]!;
      try {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 12 * 1024 * 1024 ||
          file.size < 1
        )
          throw new Error(
            ar
              ? "اختر صورة JPG أو PNG أو WebP حتى ١٢ ميغابايت."
              : "Choose a JPG, PNG or WebP photo up to 12 MB.",
          );
        const hash = await crypto.subtle.digest(
          "SHA-256",
          await file.arrayBuffer(),
        );
        const checksumSha256 = Array.from(new Uint8Array(hash))
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("");
        const receipt = await request(`${base}/attachments`, Receipt, {
          method: "POST",
          body: {
            name: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            checksumSha256,
          },
          idempotencyKey: crypto.randomUUID(),
        });
        const result = await fetch(
          `${apiOrigin()}${base}/attachments/${receipt.id}/upload`,
          {
            method: "PUT",
            credentials: "include",
            headers: {
              "Content-Type": file.type,
              "idempotency-key": crypto.randomUUID(),
            },
            body: file,
          },
        );
        if (!result.ok)
          throw new Error(
            ar
              ? "فشل رفع الصورة. حاول مجدداً."
              : "Photo upload failed. Retry the upload.",
          );
        await request(
          `${base}/attachments/${receipt.id}/verify`,
          z.object({ id: z.string() }),
          { method: "POST", body: {}, idempotencyKey: crypto.randomUUID() },
        );
        setPhotos((current) => [
          ...current,
          { id: receipt.id, name: file.name },
        ]);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Upload failed");
        setRetryFiles(remaining.slice(index));
        break;
      }
    }
    setUploading(false);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !pending && !uploading && onClose()}
    >
      <DialogContent
        dir={ar ? "rtl" : "ltr"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{ar ? "الرد على الحالة" : "Reply to case"}</DialogTitle>
          <DialogDescription>
            {ar
              ? "يمكن إرفاق ثلاث صور. لا تصبح الصورة متاحة إلا بعد التحقق منها وإرسال الرسالة."
              : "Attach up to three photos. Photos become available only after verification and sending the message."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            const body = {
              expectedRevision: revision,
              message,
              attachmentIds: photos.map((photo) => photo.id),
              ...(admin
                ? {
                    visibility,
                    notifyEmail: visibility === "customer" && notifyEmail,
                    reason: "Reply to customer support case",
                  }
                : {}),
            };
            const hash = JSON.stringify(body);
            if (command.current.hash && command.current.hash !== hash)
              command.current.key = crypto.randomUUID();
            command.current.hash = hash;
            try {
              if (admin)
                await adminApi.mutate(
                  `support/${caseId}`,
                  body,
                  command.current.key,
                );
              else
                await request(
                  `${base}/replies`,
                  z.record(z.string(), z.unknown()),
                  { method: "POST", body, idempotencyKey: command.current.key },
                );
              await client.invalidateQueries({
                queryKey: admin ? ["admin"] : ["customer-support"],
              });
              onClose();
            } catch (failure) {
              setError(
                failure instanceof Error ? failure.message : "Reply failed",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          {admin && (
            <label className="grid gap-2 text-sm">
              {ar ? "من يمكنه قراءة الرسالة" : "Who can read this message"}
              <select
                className="min-h-11 rounded border bg-background px-3"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
              >
                <option value="private">
                  {ar ? "ملاحظة خاصة للمالك" : "Private owner note"}
                </option>
                <option value="customer">
                  {ar ? "العميل والدعم" : "Customer and support"}
                </option>
              </select>
            </label>
          )}
          {admin && visibility === "customer" && (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={notifyEmail}
                onChange={(event) => setNotifyEmail(event.target.checked)}
              />
              <span>
                {ar
                  ? "إرسال إشعار بالبريد أيضاً (يتطلب تفعيل البريد وحساب عميل موثق)."
                  : "Also email the customer (requires enabled delivery and a verified customer account)."}
              </span>
            </label>
          )}
          <label className="grid gap-2 text-sm">
            {ar ? "رسالتك" : "Your message"}
            <Textarea
              required
              maxLength={10000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              dir="auto"
              rows={5}
            />
          </label>
          <label className="grid gap-2 text-sm">
            {ar ? "إرفاق صور (اختياري)" : "Attach photos (optional)"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading || pending || photos.length >= 3}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                void upload(files);
              }}
              aria-describedby="support-upload-help"
            />
            <small id="support-upload-help" className="text-muted-foreground">
              {ar
                ? "حتى ثلاث صور بحجم ١٢ ميغابايت لكل صورة."
                : "Up to three photos, 12 MB each."}
            </small>
          </label>
          {uploading && (
            <p role="status">
              {ar ? "جارٍ الرفع والتحقق…" : "Uploading and verifying…"}
            </p>
          )}
          <ul className="space-y-2">
            {photos.map((photo) => (
              <li key={photo.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 break-words">{photo.name}</span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || uploading}
                  onClick={() =>
                    setPhotos((current) =>
                      current.filter((item) => item.id !== photo.id),
                    )
                  }
                >
                  {ar ? "إزالة" : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {retryFiles.length > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={uploading || pending}
              onClick={() => void upload(retryFiles)}
            >
              {ar ? "إعادة محاولة الرفع" : "Retry upload"}
            </Button>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending || uploading}
              onClick={onClose}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button disabled={pending || uploading || !message.trim()}>
              {pending
                ? ar
                  ? "جارٍ الإرسال…"
                  : "Sending…"
                : ar
                  ? "إرسال الرسالة"
                  : "Send message"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
