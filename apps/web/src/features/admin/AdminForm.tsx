import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/i18n/LanguageContext";

export type AdminFormField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "textarea"
    | "select"
    | "checkbox"
    | "datetime-local"
    | "password";
  options?: Array<{ value: string; label: string }>;
  value?: string | number | boolean;
  required?: boolean;
  hint?: string;
  min?: number;
  max?: number;
};
export function AdminForm({
  title,
  description,
  fields,
  onSubmit,
  onClose,
  submitLabel,
}: {
  title: string;
  description: string;
  fields: AdminFormField[];
  onSubmit: (values: Record<string, unknown>, key: string) => Promise<unknown>;
  onClose: () => void;
  submitLabel?: string;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.value ?? (field.type === "checkbox" ? false : ""),
      ]),
    ),
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const operation = useRef({ hash: "", key: crypto.randomUUID() });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        dir={ar ? "rtl" : "ltr"}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending) return;
            setPending(true);
            setError("");
            const hash = JSON.stringify(values);
            if (operation.current.hash && operation.current.hash !== hash)
              operation.current.key = crypto.randomUUID();
            operation.current.hash = hash;
            try {
              await onSubmit(values, operation.current.key);
              onClose();
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : ar
                    ? "تعذر إتمام الإجراء"
                    : "The action could not be completed.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          {fields.map((field) => {
            const id = `admin-field-${field.name}`;
            const hintId = `${id}-hint`;
            return (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={id}>
                  {field.label}
                  {field.required ? " *" : ""}
                </Label>
                {field.type === "select" ? (
                  <select
                    id={id}
                    className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    value={String(values[field.name] ?? "")}
                    required={field.required}
                    aria-describedby={field.hint ? hintId : undefined}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "checkbox" ? (
                  <input
                    id={id}
                    type="checkbox"
                    className="ms-3 h-4 w-4 accent-primary"
                    checked={Boolean(values[field.name])}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: event.target.checked,
                      }))
                    }
                  />
                ) : field.type === "textarea" ? (
                  <Textarea
                    id={id}
                    value={String(values[field.name] ?? "")}
                    required={field.required}
                    maxLength={10000}
                    aria-describedby={field.hint ? hintId : undefined}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <Input
                    id={id}
                    type={field.type ?? "text"}
                    value={String(values[field.name] ?? "")}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    maxLength={field.type === "number" ? undefined : 1000}
                    aria-describedby={field.hint ? hintId : undefined}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]:
                          field.type === "number"
                            ? Number(event.target.value)
                            : event.target.value,
                      }))
                    }
                  />
                )}
                {field.hint && (
                  <p id={hintId} className="text-xs text-muted-foreground">
                    {field.hint}
                  </p>
                )}
              </div>
            );
          })}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onClose}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? ar
                  ? "جارٍ التنفيذ…"
                  : "Working…"
                : (submitLabel ?? (ar ? "تأكيد" : "Confirm"))}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
