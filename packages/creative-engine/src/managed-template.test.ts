import { describe, expect, it } from "vitest";
import { ManagedTemplateFormSchema } from "@movprompt/contracts";
import { getCreativeTemplate } from "./catalog.js";
import {
  defaultManagedTemplateForm,
  managedTemplateDefinitionIssues,
  managedTemplateInputIssues,
} from "./managed-template.js";

describe("executable managed forms", () => {
  it("enforces versioned resolution limits through the shared API/worker validator", () => {
    const definition = { ...getCreativeTemplate("ad-studio-brand-ad"), supportedResolutions: ["480p" as const] };
    expect(managedTemplateInputIssues(definition, { generation: { resolution: "720p" } })).toContain("resolution_not_supported");
    expect(managedTemplateInputIssues(definition, { generation: { resolution: "480p" } })).not.toContain("resolution_not_supported");
    expect(managedTemplateInputIssues(definition, { generation: {} })).toContain("resolution_not_supported");
  });
  it.each([
    "premium-phone-reveal",
    "female-product-review",
    "ad-studio-brand-ad",
    "product-with-model-ad",
  ])("binds every baseline control for %s", (id) => {
    const recipe = getCreativeTemplate(id);
    const managedForm = defaultManagedTemplateForm(recipe);
    expect(ManagedTemplateFormSchema.safeParse(managedForm).success).toBe(true);
    expect(managedTemplateDefinitionIssues({ ...recipe, managedForm })).toEqual(
      [],
    );
  });
  it("rejects unbound speech controls and removing required family inputs", () => {
    const recipe = getCreativeTemplate("premium-phone-reveal");
    const form = defaultManagedTemplateForm(recipe);
    form.fields.push({
      binding: "presenter.configuration",
      required: false,
      visibleWhen: "always",
      label: { en: "Speaker", ar: "الشخصية" },
    });
    expect(
      managedTemplateDefinitionIssues({ ...recipe, managedForm: form }),
    ).toContain("speech_family_unsupported");
    const ad = getCreativeTemplate("ad-studio-brand-ad");
    const managedForm = defaultManagedTemplateForm(ad);
    managedForm.fields = managedForm.fields.filter(
      (field) => field.binding !== "adstudio.videoIdea",
    );
    expect(managedTemplateDefinitionIssues({ ...ad, managedForm })).toContain(
      "required_binding_missing:adstudio.videoIdea",
    );
  });
  it("keeps display fields optional, rejects duplicate bindings and hiding consent/setup", () => {
    const form = defaultManagedTemplateForm(
      getCreativeTemplate("female-product-review"),
    );
    const offer = form.fields.find(
      (field) => field.binding === "display.offer",
    )!;
    expect(
      ManagedTemplateFormSchema.safeParse({
        ...form,
        fields: form.fields.map((field) =>
          field === offer ? { ...field, required: true } : field,
        ),
      }).success,
    ).toBe(false);
    expect(
      ManagedTemplateFormSchema.safeParse({
        ...form,
        fields: [...form.fields, offer],
      }).success,
    ).toBe(false);
    expect(
      ManagedTemplateFormSchema.safeParse({
        ...form,
        fields: form.fields.map((field) =>
          field.binding === "presenter.configuration"
            ? { ...field, visibleWhen: "silent" }
            : field,
        ),
      }).success,
    ).toBe(false);
  });
  it("validates user facts without using library names or inventing optional display copy", () => {
    const recipe = getCreativeTemplate("premium-phone-reveal");
    const managedForm = defaultManagedTemplateForm(recipe);
    managedForm.fields.push({
      binding: "product.description",
      required: true,
      visibleWhen: "always",
      label: { en: "Confirmed product details", ar: "معلومات المنتج المعتمدة" },
    });
    const definition = { ...recipe, managedForm };
    expect(
      managedTemplateInputIssues(definition, {
        generation: {
          creativeBrief: {
            product: { name: "Phone", description: "" },
            displayCopy: { offer: "", closingMessage: "" },
          },
        },
      }),
    ).toEqual(["required_field:product.description"]);
    const root = {
      generation: {
        creativeBrief: {
          product: { name: "Phone", description: "Confirmed details" },
          displayCopy: { offer: "خصم ٢٠٪ حتى الجمعة", closingMessage: "" },
        },
      },
    };
    const before = structuredClone(root);
    expect(managedTemplateInputIssues(definition, root)).toEqual([]);
    expect(root).toEqual(before);
  });
});
