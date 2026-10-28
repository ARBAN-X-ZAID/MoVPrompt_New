import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  defaultManagedTemplateForm,
  getCreativeTemplate,
} from "@movprompt/creative-engine";
import { ManagedTemplateScreen } from "./ManagedTemplateScreen";
import { createDraftProject, getProjectTemplate } from "./templates";
import type { TemplateCreateScreenProps } from "./TemplateCreateScreen";
vi.mock("./useCapabilities", () => ({
  useCapabilities: () => ({
    templateReady: true,
    active: { durations: [8, 15, 20] },
  }),
}));
describe("managed form display-copy preservation", () => {
  it("keeps existing exact messages editable when a field is removed or conditionally hidden", () => {
    const definition = structuredClone(
      getCreativeTemplate("premium-phone-reveal"),
    );
    definition.managedForm = defaultManagedTemplateForm(definition);
    definition.managedForm.fields = definition.managedForm.fields
      .filter((field) => field.binding !== "display.offer")
      .map((field) =>
        field.binding === "display.closingMessage"
          ? { ...field, visibleWhen: "speaking" }
          : field,
      );
    const project = {
      ...createDraftProject(definition.id),
      templateDefinition: definition,
      displayCopy: {
        version: 1 as const,
        openingMessage: "  Special launch  ",
        offer: "خصم ٢٠٪ حتى الجمعة!",
        closingMessage: "Call us at 1234.",
      },
    };
    const actions = {
      onFiles: vi.fn(),
      onLinkChange: vi.fn(),
      onImportLink: vi.fn(),
      onCancelImport: vi.fn(),
      onDurationChange: vi.fn(),
      onMessageChange: vi.fn(),
      onActionChange: vi.fn(),
      onOpeningMessageChange: vi.fn(),
      onChangeTemplate: vi.fn(),
      onGenerate: vi.fn(),
      onSettingsChange: vi.fn(),
      onDescriptionChange: vi.fn(),
      onLanguageChange: vi.fn(),
      onSecureCampaign: vi.fn(async () => project),
      onLibraryLogo: vi.fn(async () => undefined),
    };
    const props: TemplateCreateScreenProps = {
      project,
      template: getProjectTemplate(project),
      durationSeconds: 8,
      linkUrl: "",
      signedIn: false,
      quote: null,
      quoteState: "loading",
      ...actions,
    };
    render(<ManagedTemplateScreen {...props} />);
    expect(
      screen.getByLabelText("Offer or message to display (optional)"),
    ).toHaveValue(project.displayCopy.offer);
    expect(screen.getByLabelText("Closing message (optional)")).toHaveValue(
      project.displayCopy.closingMessage,
    );
    expect(screen.getByLabelText("Opening message (optional)")).toHaveValue(
      project.displayCopy.openingMessage,
    );
    fireEvent.change(screen.getByLabelText("Closing message (optional)"), {
      target: { value: "" },
    });
    expect(actions.onActionChange).toHaveBeenCalledWith("");
    expect(actions.onGenerate).not.toHaveBeenCalled();
  });
});
