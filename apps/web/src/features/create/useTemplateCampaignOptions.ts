import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicTemplate } from "@movprompt/contracts";
import { portableCreatorApi } from "@/lib/api/portableApiClient";
import { templateCampaignOptions } from "./templateCampaignOptions";
import { templateSettingsFromCatalog } from "./templateCatalogMapper";
import { registerTemplateSettings } from "./templates";
import type { CreatorTemplate } from "./types";

type CatalogState = { key: string; template?: PublicTemplate; error?: string; unavailable?: boolean };

/**
 * Live owner settings for the template being edited. A pinned draft keeps its
 * immutable recipe, but names, languages and lengths still come from the head.
 */
export function useTemplateCampaignOptions(template: CreatorTemplate, usePublishedCatalog: boolean) {
  const pinnedVersionId = template.definition ? template.versionId : undefined;
  const pinned = Boolean(pinnedVersionId);
  const key = pinnedVersionId ?? template.id;
  const [catalog, setCatalog] = useState<CatalogState | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!usePublishedCatalog) return;
    let active = true;
    setCatalog(null);
    const load = () => {
      void (pinnedVersionId ? portableCreatorApi.getTemplateVersion(pinnedVersionId) : portableCreatorApi.getTemplate(key))
        .then(published => {
          if (!active) return;
          registerTemplateSettings(published.slug, templateSettingsFromCatalog(published));
          setCatalog({ key, template: published });
        })
        .catch((error: unknown) => {
          if (!active) return;
          const unavailable = (error as { status?: number }).status === 404;
          // A background refresh must not discard settings that already loaded.
          setCatalog(current => current?.key === key && current.template && !unavailable
            ? current
            : { key, error: "Could not load this template’s supported settings. Retry the template check.", unavailable });
        });
    };
    reload.current = load;
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      reload.current = () => undefined;
      window.removeEventListener("focus", load);
    };
  }, [key, pinnedVersionId, usePublishedCatalog, revision]);
  const refresh = useCallback(() => reload.current(), []);
  const matching = catalog?.key === key ? catalog : null;
  const live = matching?.template;
  return {
    /** The template as buyers should see it now, or as bundled if the catalog is unreachable. */
    template: live ? { ...template, ...templateSettingsFromCatalog(live) } : template,
    options: pinned
      ? { ...templateCampaignOptions(template), languages: live?.supportedLanguages ?? template.languages }
      : templateCampaignOptions(live ?? template),
    ready: pinned || !usePublishedCatalog || Boolean(live),
    error: pinned ? "" : matching?.error ?? "",
    /** The template was unpublished, so retrying cannot help. */
    unavailable: !pinned && matching?.unavailable === true,
    retry: () => setRevision(value => value + 1),
    refresh,
  };
}
