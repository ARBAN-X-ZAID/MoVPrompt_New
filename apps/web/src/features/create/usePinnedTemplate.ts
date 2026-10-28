import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { CreativeTemplateRecipeSchema } from "@movprompt/creative-engine";
import { portableCreatorApi } from "@/lib/api/portableApiClient";
import { creatorTemplateFromCatalog } from "./templateCatalogMapper";
import { projectWithDuration } from "./templates";
import type { CreatorProject } from "./types";

/** Cached definitions are for draft persistence. A reopened editor verifies its
 * pin against the immutable server version before it can request a quote. */
export function usePinnedTemplate(
  project: CreatorProject,
  setProject: Dispatch<SetStateAction<CreatorProject>>,
  enabled: boolean,
  requestedSlug?: string | null,
) {
  const [state, setState] = useState({ key: "", ready: false, error: "" });
  const verified = useRef("");
  const [retryVersion, setRetryVersion] = useState(0);
  const slug =
    project.templateCatalogSlug ?? requestedSlug ?? project.templateId;
  const key = `${project.id}:${project.pinnedTemplateVersionId ?? slug}`;
  useEffect(() => {
    if (!enabled || verified.current === key) return;
    let active = true;
    const projectId = project.id;
    const versionId = project.pinnedTemplateVersionId;
    setState({ key, ready: false, error: "" });
    const lookup = versionId
      ? portableCreatorApi.getTemplateVersion(versionId)
      : portableCreatorApi.getTemplate(slug);
    void lookup
      .then((published) => {
        if (!active) return;
        const definition = CreativeTemplateRecipeSchema.parse(
          published.executableDefinition,
        );
        creatorTemplateFromCatalog(published);
        const nextKey = `${projectId}:${published.versionId}`;
        setProject((current) => {
          if (
            current.id !== projectId ||
            current.pinnedTemplateVersionId !== versionId
          )
            return current;
          const next = {
            ...current,
            templateId: definition.id,
            templateCatalogSlug: published.slug,
            pinnedTemplateVersionId: published.versionId,
            templateDefinition: definition,
          };
          // Keep a buyer's selected length even if a newly selected family does
          // not support it. They must choose a supported option explicitly.
          return definition.supportedDurations &&
            !definition.supportedDurations.includes(
              current.durationSeconds as 8 | 15 | 20,
            )
            ? next
            : projectWithDuration(next, current.durationSeconds);
        });
        verified.current = nextKey;
        setState({ key: nextKey, ready: true, error: "" });
      })
      .catch(() => {
        if (active)
          setState({
            key,
            ready: false,
            error: "Could not load this template version. Please retry.",
          });
      });
    return () => {
      active = false;
    };
  }, [
    enabled,
    key,
    project.id,
    project.pinnedTemplateVersionId,
    slug,
    setProject,
    retryVersion,
  ]);
  return {
    ready: !enabled || (state.key === key && state.ready),
    error: state.key === key ? state.error : "",
    retry: () => setRetryVersion((value) => value + 1),
  };
}
