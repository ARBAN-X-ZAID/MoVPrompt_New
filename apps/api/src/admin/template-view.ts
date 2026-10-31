import type { Db, Document } from "mongodb";
import {
  COLLECTIONS,
  STORED_TEMPLATE_SUMMARY_PROJECTION,
  hasStoredTemplateDefinition,
  resolveStoredTemplateDefinition,
  storedTemplateSummary,
  type StoredTemplateSummary,
} from "@movprompt/db";
import {
  effectiveTemplateDurations,
  effectiveTemplateLanguages,
  supportsNativeUgc,
  type AdminTemplateOverrides,
  type TemplateSelectableLanguage,
} from "@movprompt/contracts";
import { adminObjectId } from "./security.js";

/** Request field to the head field holding that override. */
export const TEMPLATE_DETAIL_FIELDS = {
  displayName: "displayName",
  displayDescription: "displayDescription",
  displayOutcome: "displayOutcome",
  category: "displayCategory",
  discoveryCategory: "displayDiscoveryCategory",
  tags: "displayTags",
  sortOrder: "displaySortOrder",
  enabledLanguages: "enabledLanguages",
} as const;

export function templateOverrides(row: Document): AdminTemplateOverrides {
  return {
    displayName: row.displayName ?? null,
    displayDescription: row.displayDescription ?? null,
    displayOutcome: row.displayOutcome ?? null,
    category: row.displayCategory ?? null,
    discoveryCategory: row.displayDiscoveryCategory ?? null,
    tags: row.displayTags ?? null,
    sortOrder: row.displaySortOrder ?? null,
    enabledLanguages: row.enabledLanguages ?? null,
  };
}

/** What the owner sees: effective values, the overrides behind them, and the version's defaults. */
export function adminTemplateView(row: Document, version: Document, definition: StoredTemplateSummary) {
  const supportedDurations = definition.supportedDurations ?? [definition.durationSeconds];
  const selectableLanguages = definition.supportedLanguages.filter(
    (language): language is TemplateSelectableLanguage => language !== "bilingual",
  );
  const defaults = {
    name: definition.localizedName,
    description: definition.localizedDescription,
    // Immutable versions hold English "best for" copy only.
    outcome: { en: definition.outcome, ar: definition.outcome },
    category: definition.category,
    discoveryCategory: definition.discoveryCategory,
    tags: definition.tags,
    sortOrder: definition.sortOrder ?? null,
  };
  return {
    // Heads only gain a revision on their first edit; concurrency checks start at 0.
    revision: row.revision ?? 0,
    name: row.displayName ?? defaults.name,
    description: row.displayDescription ?? defaults.description,
    outcome: row.displayOutcome ?? defaults.outcome,
    category: row.displayCategory ?? row.category ?? defaults.category,
    discoveryCategory: row.displayDiscoveryCategory ?? row.discoveryCategory ?? defaults.discoveryCategory,
    tags: row.displayTags ?? defaults.tags,
    sortOrder: row.displaySortOrder ?? defaults.sortOrder,
    familyId: definition.id,
    supportedDurations,
    enabledDurations: effectiveTemplateDurations(supportedDurations, row.enabledDurations),
    supportedRatios: definition.supportedRatios,
    supportedLanguages: definition.supportedLanguages,
    selectableLanguages,
    enabledLanguages: effectiveTemplateLanguages(selectableLanguages, row.enabledLanguages),
    photoPolicy: definition.photoPolicy ?? null,
    presenterModes: version.recipe?.presenterModes ?? [],
    speechSupported: supportsNativeUgc(definition.id),
    templateMedia: version.templateMedia ?? null,
    overrides: templateOverrides(row),
    defaults,
  };
}

export async function addAdminTemplateView(db: Db, row: Document): Promise<void> {
  if (!row.currentPublishedVersionId) return;
  const version = await db.collection(COLLECTIONS.videoTemplateVersions).findOne({ _id: adminObjectId(String(row.currentPublishedVersionId)), templateId: row._id });
  if (version) Object.assign(row, adminTemplateView(row, version, resolveStoredTemplateDefinition(version, String(version.recipe?.familyId ?? row.slug))));
}

/** One page of templates: one batched version read, no full recipe and no per-row validation. */
export async function addAdminTemplateViews(db: Db, rows: Document[]): Promise<void> {
  const versionIdOf = (row: Document) => adminObjectId(String(row.currentPublishedVersionId));
  const published = rows.filter(row => row.currentPublishedVersionId);
  if (!published.length) return;
  const versions = db.collection(COLLECTIONS.videoTemplateVersions);
  const found = new Map((await versions
    .find({ _id: { $in: published.map(versionIdOf) } }, { projection: { ...STORED_TEMPLATE_SUMMARY_PROJECTION, templateId: 1 } })
    .toArray()).map(version => [String(version._id), version]));
  const matching = published.flatMap(row => {
    const version = found.get(String(row.currentPublishedVersionId));
    return version && String(version.templateId) === String(row._id) ? [{ row, version }] : [];
  });
  // Versions predating stored definitions rebuild from the catalog baseline and
  // can read any recipe field, so these few take the complete document.
  const legacy = matching.filter(({ version }) => !hasStoredTemplateDefinition(version));
  const complete = new Map(legacy.length
    ? (await versions.find({ _id: { $in: legacy.map(({ version }) => version._id) } }).toArray()).map(version => [String(version._id), version])
    : []);
  for (const { row, version } of matching) {
    const full = complete.get(String(version._id));
    const definition = full
      ? resolveStoredTemplateDefinition(full, String(full.recipe?.familyId ?? row.slug))
      : storedTemplateSummary(version);
    Object.assign(row, adminTemplateView(row, version, definition));
  }
}
