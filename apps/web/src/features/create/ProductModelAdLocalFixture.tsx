import React, { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { defaultProductModelAdSettings, templatePhotoIssues, type BrandKitRecord, type TemplatePhotoRole } from "@movprompt/contracts";
import { compileTemplatePrompt, CreativeBriefSchema, LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import { ProductModelAdScreen } from "./ProductModelAdScreen";
import { createDraftProject, getCreatorTemplate, projectWithDuration } from "./templates";
import { projectWithModelAdSettings } from "./productModelAdProject";
import { buildPortableGenerationConfiguration } from "./projectStore";
import "./creator.css";

if (!import.meta.env.DEV) throw new Error("This fixture is available only in local development.");
const library: BrandKitRecord[] = [];
// This separate development page never contacts a server, database or provider.
window.fetch = async (url, options) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path.endsWith("/capabilities/video")) return Response.json({ active: { durations: [8, 15, 20], minimumDurationSeconds: 4, maximumDurationSeconds: 30 }, templateReady: true, evaluatedAt: new Date().toISOString() });
  if (path.endsWith("/brand-kits")) {
    if (options?.method === "POST") {
      const data = JSON.parse(String(options.body));
      const record = { id: data.id ?? "a".repeat(24), revision: (data.expectedRevision ?? 0) + 1, snapshot: data.snapshot, updatedAt: new Date().toISOString() };
      library.splice(0, library.length, record); return Response.json({ kit: record });
    }
    return Response.json({ kits: library });
  }
  throw new Error(`Network access blocked in unpaid local fixture: ${path}`);
};
export function ProductModelAdLocalFixture() {
  const [arabic, setArabic] = useState(false);
  const [dark, setDark] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [project, setProject] = useState(() => {
    const source = createDraftProject("product-with-model-ad");
    source.product.name = "Sage water bottle";
    source.product.sourceType = "upload";
    source.product.description = "Sage-colored bottle from the uploaded reference.";
    const art = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><rect width="240" height="320" fill="#eee8dd"/><rect x="83" y="68" width="74" height="195" rx="25" fill="#a4af97"/><rect x="90" y="43" width="60" height="48" rx="9" fill="#929e86"/><ellipse cx="120" cy="278" rx="67" ry="10" fill="#d1c9bb"/></svg>';
    source.product.images = [{ id: crypto.randomUUID(), name: "synthetic-local-bottle.png", url: `data:image/svg+xml,${encodeURIComponent(art)}`, mimeType: "image/png", referenceRole: "subject", selected: true, checksum: "a".repeat(64), source: "upload" }];
    const settings = defaultProductModelAdSettings(); settings.brandKit.name = "Demo Studio"; settings.brandKit.tagline = "Made for every day";
    return projectWithDuration(projectWithModelAdSettings(source, settings), 8);
  });
  const fact = (field: "name" | "description", text: string) => setProject(current => ({ ...current, source: undefined, product: { ...current.product, [field]: text } }));
  async function upload(files: readonly File[] | FileList | null, role: TemplatePhotoRole = "subject") {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (selected.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setError("Photos only: JPG, PNG or WebP."); return; }
    const existing = project.product.images.filter(image => image.selected !== false && image.referenceRole === role).length;
    if (selected.length + (role === "artwork" ? 0 : existing) > (role === "artwork" ? 1 : 3)) { setError("This batch exceeds the photo limit. No files were added."); return; }
    const images = await Promise.all(selected.map(async file => {
      const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      return { id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file), mimeType: file.type, source: "upload" as const, referenceRole: role, selected: role !== "artwork", checksum: Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, "0")).join("") };
    }));
    setProject(current => {
      const next = { ...current, product: { ...current.product, images: [...current.product.images, ...images] } };
      return role === "artwork" ? projectWithModelAdSettings(next, { ...next.productModelAd!, brandKit: { ...next.productModelAd!.brandKit, logoChecksum: images[0]!.checksum } }) : projectWithDuration(next, next.durationSeconds);
    }); setError("");
  }
  return <div className={dark ? "dark" : ""}><main className="creator-app" style={{ minHeight: "100vh", padding: "20px", boxSizing: "border-box" }}>
    <div style={{ maxWidth: 1160, marginInline: "auto", display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}><strong>UNPAID LOCAL FIXTURE — synthetic source; no video generation</strong><button type="button" onClick={() => setArabic(value => !value)}>English / العربية</button><button type="button" onClick={() => setDark(value => !value)}>Light / Dark</button></div>
    <ProductModelAdScreen project={project} template={getCreatorTemplate(project.templateId)} durationSeconds={project.durationSeconds} signedIn arabic={arabic} linkUrl="" hidePricing quote={null} quoteState="ready" error={error}
      onSettingsChange={settings => setProject(current => projectWithModelAdSettings(current, settings))} onDescriptionChange={text => fact("description", text)} onNameChange={text => fact("name", text)} onLanguageChange={language => setProject(current => ({ ...current, language }))}
      onDurationChange={duration => setProject(current => projectWithDuration(current, duration))} onFiles={upload} onPhotoChange={(id, patch) => setProject(current => projectWithDuration({ ...current, product: { ...current.product, images: current.product.images.map(image => image.id === id ? { ...image, ...patch } : image) } }, current.durationSeconds))}
      onRemoveImage={id => setProject(current => ({ ...current, product: { ...current.product, images: current.product.images.filter(image => image.id !== id) } }))}
      onMessageChange={offer => setProject(current => ({ ...current, offer }))} onActionChange={cta => setProject(current => ({ ...current, cta }))} onChangeTemplate={() => setFeedback("Existing forms are covered by regression tests.")}
      onSecureCampaign={async () => { throw new Error("Database writes are disabled in this local fixture."); }} onLibraryLogo={async () => { throw new Error("Library logo transfer is covered by contract tests."); }} onLinkChange={() => undefined} onImportLink={() => undefined} onCancelImport={() => undefined}
      onGenerate={() => {
        try {
          const generation = buildPortableGenerationConfiguration(project);
          const issues = templatePhotoIssues(LAUNCH_PHOTO_POLICIES[project.templateId]!, project.product.images.filter(image => image.selected !== false));
          if (issues.length) throw new Error(issues.join(", "));
          const compiled = compileTemplatePrompt({ brief: CreativeBriefSchema.parse(generation.creativeBrief), photos: project.product.images.filter(image => image.selected !== false), aspectRatio: project.aspectRatio });
          setFeedback(`Unpaid validation passed: ${project.durationSeconds}s, 9:16, instrumental music, ${compiled.prompt.length} prompt characters. Paid calls: 0.`);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Validation failed"); }
      }} />
    {feedback && <output role="status" style={{ display: "block", maxWidth: 1160, margin: "24px auto" }}>{feedback}</output>}
  </main></div>;
}
const root: Root = import.meta.hot?.data.root ?? createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<ProductModelAdLocalFixture />);
