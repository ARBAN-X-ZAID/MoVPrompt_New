import { useEffect, useState } from "react";
import type { PublicTemplate } from "@movprompt/contracts";
import { portableCreatorApi } from "@/lib/api/portableApiClient";
import { templateCampaignOptions } from "./templateCampaignOptions";
import type { CreatorTemplate } from "./types";

export function useTemplateCampaignOptions(template: CreatorTemplate, usePublishedCatalog: boolean) {
  const [catalog, setCatalog] = useState<{ id: string; template?: PublicTemplate; error?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!usePublishedCatalog) return;
    let active = true;
    setCatalog(null);
    void portableCreatorApi.getTemplate(template.id)
      .then(published => { if (active) setCatalog({ id: template.id, template: published }); })
      .catch(() => { if (active) setCatalog({ id: template.id, error: "Could not load this template’s supported settings. Retry the template check." }); });
    return () => { active = false; };
  }, [template.id, usePublishedCatalog, revision]);
  const matching = catalog?.id === template.id ? catalog : null;
  return {
    options: templateCampaignOptions(matching?.template ?? template),
    ready: !usePublishedCatalog || Boolean(matching?.template),
    error: matching?.error ?? "",
    retry: () => setRevision(value => value + 1),
  };
}
