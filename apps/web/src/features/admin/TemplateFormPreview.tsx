import { useState } from "react";
import type { CreativeTemplateRecipe } from "@movprompt/creative-engine";
import { defaultManagedTemplateForm } from "@movprompt/creative-engine";
import { ManagedTemplateScreen } from "@/features/create/ManagedTemplateScreen";
import {
  createDraftProject,
  getProjectTemplate,
  projectWithDuration,
} from "@/features/create/templates";
import { displayCopyForProject } from "@/features/create/displayCopyProject";
import type { CreatorProject } from "@/features/create/types";

export function TemplateFormPreview({
  definition,
  ar,
}: {
  definition: CreativeTemplateRecipe;
  ar: boolean;
}) {
  const [project, setProject] = useState<CreatorProject>(() =>
    projectWithDuration(
      {
        ...createDraftProject(definition.id),
        templateDefinition: {
          ...definition,
          managedForm:
            definition.managedForm ?? defaultManagedTemplateForm(definition),
        },
      },
      definition.durationSeconds,
    ),
  );
  const update = (changes: Partial<CreatorProject>) =>
    setProject((current) => ({ ...current, ...changes }));
  return (
    <div>
      <p className="mb-4 rounded border p-4 text-sm text-muted-foreground">
        {ar
          ? "معاينة النموذج فقط. لا تُحفظ بيانات التجربة. رفع الملفات والتوليد معطلان هنا."
          : "Form preview only. Trial values are not saved. Uploads and generation are disabled here."}
      </p>
      <ManagedTemplateScreen
        project={project}
        template={getProjectTemplate(project)}
        durationSeconds={project.durationSeconds}
        arabic={ar}
        signedIn
        busy
        quote={null}
        quoteState="unavailable"
        hidePricing
        linkUrl=""
        onLinkChange={() => undefined}
        onImportLink={() => undefined}
        onCancelImport={() => undefined}
        onFiles={() => undefined}
        onChangeTemplate={() => undefined}
        onGenerate={() => undefined}
        onDurationChange={(seconds) =>
          setProject((current) => projectWithDuration(current, seconds))
        }
        onAspectRatioChange={(aspectRatio) => update({ aspectRatio })}
        onNameChange={(name) =>
          update({ product: { ...project.product, name } })
        }
        onDescriptionChange={(description) =>
          update({ product: { ...project.product, description } })
        }
        onOpeningMessageChange={(openingMessage) =>
          update({
            displayCopy: { ...displayCopyForProject(project), openingMessage },
          })
        }
        onMessageChange={(offer) =>
          update({ displayCopy: { ...displayCopyForProject(project), offer } })
        }
        onActionChange={(closingMessage) =>
          update({
            displayCopy: { ...displayCopyForProject(project), closingMessage },
          })
        }
        onSettingsChange={(productModelAd) => update({ productModelAd })}
        onBrandAdSettingsChange={(adStudioBrandAd) =>
          update({ adStudioBrandAd })
        }
        onProjectSettingsChange={update}
        onLanguageChange={(language) => update({ language })}
        onNativeUgcChange={(nativeUgc) => update({ nativeUgc })}
        onSecureCampaign={async () => project}
        onLibraryLogo={async () => undefined}
      />
    </div>
  );
}
