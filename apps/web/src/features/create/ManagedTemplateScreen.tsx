import { useId } from "react";
import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import {
  AD_STUDIO_BRAND_AD_ID,
  PRODUCT_MODEL_AD_ID,
  AD_STUDIO_BRAND_AD_LIMITS,
  isManagedTemplateFieldVisible,
  templatePhotoIssues,
  type AdStudioBrandAdSettings,
  type ManagedTemplateField,
} from "@movprompt/contracts";
import {
  defaultManagedTemplateForm,
  managedTemplateInputIssues,
  SELECTABLE_TEMPLATE_DURATIONS,
} from "@movprompt/creative-engine";
import { TemplatePhotos } from "./TemplatePhotos";
import { NativeUgcForm } from "./NativeUgcForm";
import { nativeUgcFeedback } from "./nativeUgcProject";
import { modelAdSettingsForProject } from "./productModelAdProject";
import { brandAdSettingsForProject } from "./adStudioBrandAdProject";
import { displayCopyForProject } from "./displayCopyProject";
import { useCapabilities } from "./useCapabilities";
import { GenerateLabel, CreditShortfallNotice } from "./creditGate";
import type { TemplateCreateScreenProps } from "./TemplateCreateScreen";
import "./managed-template.css";

/** Every control writes an existing campaign binding. Recipe metadata can never
 * supply customer facts, dialogue, consent, or default promotional text. */
export function ManagedTemplateScreen(props: TemplateCreateScreenProps) {
  const { project, arabic = false } = props;
  const definition = project.templateDefinition!;
  const form = definition.managedForm!;
  const id = useId();
  const t = (en: string, ar: string) => (arabic ? ar : en);
  const locale = arabic ? "ar" : "en";
  const display = displayCopyForProject(project);
  const ad = brandAdSettingsForProject(project);
  const model = modelAdSettingsForProject(project);
  const photos = project.product.images.filter(
    (photo) => photo.selected !== false,
  );
  const capabilities = useCapabilities();
  const photoIssues = definition.photoPolicy
    ? templatePhotoIssues(definition.photoPolicy, photos)
    : [];
  const formIssues = managedTemplateInputIssues(definition, {
    creativeBrief: {
      product: project.product,
      adStudioBrandAd: ad,
      nativeUgc: project.nativeUgc,
      displayCopy: display,
    },
  });
  const speechIssue = nativeUgcFeedback(project, arabic);
  const modelIssue =
    project.templateId === PRODUCT_MODEL_AD_ID &&
    (model.modelChoice === "reference_adult"
      ? !photos.some((photo) => photo.referenceRole === "character")
      : photos.some((photo) => photo.referenceRole === "character"));
  const unavailable =
    !capabilities.templateReady ||
    !capabilities.active.durations.includes(project.durationSeconds);
  const blocked = Boolean(
    props.busy ||
    props.creditShortfall ||
    speechIssue ||
    modelIssue ||
    photoIssues.length ||
    formIssues.length ||
    unavailable ||
    props.quoteState !== "ready" ||
    (!props.hidePricing && !props.quote),
  );
  const feedback =
    props.generationError ||
    props.error ||
    speechIssue ||
    (photoIssues.length
      ? t(
          "Check the selected photos and confirm permission for every adult reference.",
          "راجع الصور المحددة وأكّد الإذن لكل صورة شخص بالغ.",
        )
      : "") ||
    (modelIssue
      ? t(
          "Match your presenter choice to the selected character photos.",
          "طابق اختيار الشخصية مع صورها المحددة.",
        )
      : "") ||
    (formIssues.length
      ? t("Complete the required fields below.", "أكمل الحقول المطلوبة أدناه.")
      : "") ||
    (unavailable
      ? t(
          "Generation is temporarily unavailable. Your setup is saved.",
          "التوليد غير متاح مؤقتاً. إعداداتك محفوظة.",
        )
      : props.quoteError);
  const updateAd = (key: string, value: string) =>
    props.onBrandAdSettingsChange?.({
      ...ad,
      [key]: value,
    } as AdStudioBrandAdSettings);
  const logoChecksum =
    project.templateId === AD_STUDIO_BRAND_AD_ID
      ? ad.logoChecksum
      : model.brandKit.logoChecksum;
  const logo = project.product.images.find(
    (photo) =>
      photo.referenceRole === "artwork" && photo.checksum === logoChecksum,
  );
  const input = (
    field: ManagedTemplateField,
    value: string,
    onChange: (value: string) => void,
    maxLength: number,
    multiline = false,
  ) => {
    const common = {
      id: `${id}-${field.binding}`,
      value,
      onChange: (event: { target: { value: string } }) =>
        onChange(event.target.value),
      maxLength,
      required: field.required,
      dir: "auto" as const,
      "aria-describedby": field.help
        ? `${id}-${field.binding}-help`
        : undefined,
      className: "creator-input",
    };
    return multiline ? (
      <textarea {...common} rows={3} />
    ) : (
      <input {...common} type="text" />
    );
  };
  const select = (
    field: ManagedTemplateField,
    options: readonly (string | number)[],
    value: string | number,
    onChange: (value: string) => void,
  ) => (
    <select
      id={`${id}-${field.binding}`}
      className="creator-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option === "en"
            ? "English"
            : option === "ar"
              ? "العربية"
              : option === "bilingual"
                ? "English + العربية"
                : option}
        </option>
      ))}
    </select>
  );
  function control(field: ManagedTemplateField) {
    const binding = field.binding;
    if (binding === "product.photos")
      return (
        <TemplatePhotos
          templateId={project.templateId}
          photoPolicy={definition.photoPolicy}
          images={project.product.images}
          arabic={arabic}
          busy={props.busy}
          characterUploadDisabled={
            project.templateId === "female-product-review" &&
            project.nativeUgc?.enabled === true
          }
          onFiles={props.onFiles}
          onPhotoChange={props.onPhotoChange}
          onMovePhoto={props.onMovePhoto}
          onRemoveImage={props.onRemoveImage}
        />
      );
    if (binding === "product.name")
      return input(
        field,
        project.product.name,
        props.onNameChange ?? (() => undefined),
        240,
      );
    if (binding === "product.description")
      return input(
        field,
        project.product.description,
        props.onDescriptionChange,
        2000,
        true,
      );
    if (binding === "display.openingMessage")
      return input(
        field,
        display.openingMessage,
        props.onOpeningMessageChange ?? (() => undefined),
        120,
      );
    if (binding === "display.offer")
      return input(field, display.offer, props.onMessageChange, 500, true);
    if (binding === "display.closingMessage")
      return input(
        field,
        display.closingMessage,
        props.onActionChange ?? (() => undefined),
        240,
      );
    if (binding.startsWith("adstudio.")) {
      const key = binding.slice(9) as keyof typeof AD_STUDIO_BRAND_AD_LIMITS;
      return input(
        field,
        ad[key],
        (value) => updateAd(key, value),
        AD_STUDIO_BRAND_AD_LIMITS[key],
        !["brandName", "socials"].includes(key),
      );
    }
    if (binding === "video.duration")
      return select(
        field,
        definition.supportedDurations ?? SELECTABLE_TEMPLATE_DURATIONS,
        project.durationSeconds,
        (value) => props.onDurationChange(Number(value)),
      );
    if (binding === "video.ratio")
      return select(
        field,
        definition.supportedRatios,
        project.aspectRatio,
        (value) =>
          props.onAspectRatioChange?.(value as typeof project.aspectRatio),
      );
    if (binding === "video.language")
      return select(
        field,
        definition.supportedLanguages.filter(
          (language) =>
            !(project.nativeUgc?.enabled && language === "bilingual"),
        ),
        project.language,
        (value) => props.onLanguageChange(value as typeof project.language),
      );
    if (binding === "video.resolution")
      return select(field, ["480p", "720p"], project.resolution, (value) =>
        props.onProjectSettingsChange?.({
          resolution: value as typeof project.resolution,
        }),
      );
    if (binding === "video.audio")
      return (
        <label className="creator-photo-selection">
          <input
            type="checkbox"
            checked={project.audio}
            onChange={(event) => {
              props.onProjectSettingsChange?.({ audio: event.target.checked });
              if (!event.target.checked && project.nativeUgc?.enabled)
                props.onNativeUgcChange?.({
                  ...project.nativeUgc,
                  enabled: false,
                  scriptApproved: false,
                  approvedLanguage: undefined,
                });
            }}
          />
          {t(
            "Original music and approved speech when enabled",
            "موسيقى أصلية وكلام معتمد عند تفعيله",
          )}
        </label>
      );
    if (binding === "presenter.configuration")
      return (
        <NativeUgcForm
          project={project}
          onChange={props.onNativeUgcChange ?? (() => undefined)}
          onLanguageChange={props.onLanguageChange}
          onFiles={props.onFiles}
          onPhotoChange={props.onPhotoChange}
          onRemoveImage={props.onRemoveImage}
          arabic={arabic}
          disabled={props.busy}
        />
      );
    if (binding === "model.configuration")
      return (
        <div className="space-y-4">
          {(
            [
              [
                "modelChoice",
                ["realistic_adult", "illustrated_adult", "reference_adult"],
                t("Character style", "أسلوب الشخصية"),
              ],
              [
                "category",
                ["general", "accessory", "clothing", "beauty"],
                t("Product category", "فئة المنتج"),
              ],
              [
                "setting",
                ["studio", "lifestyle", "car_arrival"],
                t("Setting", "المكان"),
              ],
              [
                "action",
                [
                  "present",
                  "hold",
                  ...(["accessory", "clothing"].includes(model.category)
                    ? ["wear"]
                    : []),
                ],
                t("Action", "الحركة"),
              ],
            ] as const
          ).map(([key, choices, label]) => (
            <label
              className="managed-template-model-field"
              key={key}
              htmlFor={`${id}-${key}`}
            >
              <span>{label}</span>
              <select
                id={`${id}-${key}`}
                className="creator-input"
                value={model[key]}
                onChange={(event) => {
                  const value = event.target.value;
                  const next = { ...model, [key]: value };
                  if (
                    key === "category" &&
                    !["accessory", "clothing"].includes(value) &&
                    model.action === "wear"
                  )
                    next.action = "hold";
                  props.onSettingsChange(next);
                  if (key === "modelChoice" && value !== "reference_adult")
                    project.product.images
                      .filter(
                        (photo) =>
                          photo.referenceRole === "character" &&
                          photo.selected !== false,
                      )
                      .forEach((photo) =>
                        props.onPhotoChange?.(photo.id, { selected: false }),
                      );
                }}
              >
                {choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      );
    if (binding === "brand.logo")
      return (
        <div>
          {logo && (
            <img
              src={logo.url}
              alt={t("Your logo", "شعارك")}
              className="managed-template-logo"
            />
          )}
          <input
            id={`${id}-${field.binding}`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={props.busy}
            onChange={(event) => {
              if (event.target.files?.length)
                props.onFiles(event.target.files, "artwork", true);
              event.target.value = "";
            }}
          />
          {logo && (
            <button
              type="button"
              className="creator-button creator-button-quiet"
              onClick={() =>
                project.templateId === AD_STUDIO_BRAND_AD_ID
                  ? props.onBrandAdSettingsChange?.({
                      ...ad,
                      logoChecksum: undefined,
                    })
                  : props.onSettingsChange({
                      ...model,
                      brandKit: { ...model.brandKit, logoChecksum: undefined },
                    })
              }
            >
              {t("Remove logo", "إزالة الشعار")}
            </button>
          )}
        </div>
      );
    return null;
  }
  const grouped = new Set([
    "product.photos",
    "presenter.configuration",
    "model.configuration",
    "video.audio",
  ]);
  const displayValue = (field: ManagedTemplateField) =>
    field.binding.startsWith("display.")
      ? display[field.binding.slice(8) as keyof typeof display]
      : "";
  const fields = form.fields.filter(
    (field) =>
      isManagedTemplateFieldVisible(
        field,
        project.nativeUgc?.enabled === true,
      ) || Boolean(displayValue(field)),
  );
  const fallbackDisplay = defaultManagedTemplateForm(definition).fields.filter(
    (field) => field.binding.startsWith("display."),
  );
  fallbackDisplay.push({
    binding: "display.openingMessage",
    label: { en: "Opening message (optional)", ar: "رسالة البداية (اختياري)" },
    required: false,
    visibleWhen: "always",
  });
  for (const field of fallbackDisplay)
    if (
      !fields.some((item) => item.binding === field.binding) &&
      displayValue(field)
    )
      fields.push(field);
  return (
    <section
      className="managed-template"
      dir={arabic ? "rtl" : "ltr"}
      aria-labelledby={`${id}-title`}
    >
      <header>
        <button
          type="button"
          className="creator-button creator-button-quiet"
          onClick={props.onChangeTemplate}
        >
          <ArrowLeft aria-hidden="true" />
          {t("Change template", "غيّر القالب")}
        </button>
        <h1 id={`${id}-title`}>
          {arabic ? definition.localizedName.ar : definition.localizedName.en}
        </h1>
        <p>
          {arabic
            ? definition.localizedDescription.ar
            : definition.localizedDescription.en}
        </p>
      </header>
      <div className="managed-template-layout">
        <div className="managed-template-fields">
          {fields.map((field) => (
            <section
              key={field.binding}
              className="managed-template-field"
              data-binding={field.binding}
            >
              {grouped.has(field.binding) ? (
                <h2>{field.label[locale]}</h2>
              ) : (
                <label htmlFor={`${id}-${field.binding}`}>
                  {field.label[locale]}
                  {field.required ? " *" : ""}
                </label>
              )}
              {field.help && (
                <p id={`${id}-${field.binding}-help`}>{field.help[locale]}</p>
              )}
              {control(field)}
            </section>
          ))}
        </div>
        <aside className="managed-template-summary">
          <h2>{t("Your campaign", "حملتك")}</h2>
          <p>
            {project.durationSeconds}s · {project.aspectRatio} ·{" "}
            {project.resolution}
          </p>
          <p>
            {t(
              "Only your entered offer and closing message are displayed. Empty fields stay empty.",
              "تظهر فقط رسالتا العرض والختام اللتان تكتبهما. الحقول الفارغة تبقى فارغة.",
            )}
          </p>
          {!props.hidePricing && (
            <strong aria-live="polite">
              {props.quote
                ? `${props.quote.credits} ${t("credits", "رصيد")}`
                : t("Checking price…", "جارٍ التحقق من السعر…")}
            </strong>
          )}
          <button
            ref={props.generateButtonRef}
            type="button"
            className="creator-button creator-button-primary"
            disabled={blocked}
            onClick={props.onGenerate}
          >
            <Sparkles aria-hidden="true" />
            <GenerateLabel
              signIn={props.signInToGenerate}
              arabic={arabic}
              english="Generate video"
              arabicLabel="ولّد الفيديو"
            />
          </button>
          {props.creditShortfall && (
            <CreditShortfallNotice
              id={`${id}-credits`}
              shortfall={props.creditShortfall}
              arabic={arabic}
            />
          )}
          {feedback && <p role="status">{feedback}</p>}
          {props.onRetryQuote && (
            <button
              type="button"
              className="creator-button creator-button-quiet"
              onClick={props.onRetryQuote}
            >
              <RefreshCw aria-hidden="true" />
              {t("Refresh generation check", "تحديث فحص التوليد")}
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}
