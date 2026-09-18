export interface LearnTocItem {
  id: string;
  labelKey: string;
}

export const LEARN_TOC: LearnTocItem[] = [
  { id: "getting-started", labelKey: "learn.toc.gettingStarted" },
  { id: "workflows", labelKey: "learn.toc.workflows" },
  { id: "models", labelKey: "learn.toc.models" },
  { id: "scene-analysis", labelKey: "learn.toc.sceneAnalysis" },
  { id: "descriptions", labelKey: "learn.toc.descriptions" },
  { id: "references", labelKey: "learn.toc.references" },
  
  { id: "pro-tips", labelKey: "learn.toc.proTips" },
  { id: "faq", labelKey: "learn.toc.faq" },
];
