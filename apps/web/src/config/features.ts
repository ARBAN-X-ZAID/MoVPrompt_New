export type ProductFeature =
  | "guestCreator"
  | "workspaceShell"
  | "projects"
  | "advancedMode"
  | "exportPipeline"
  | "portableAuth"
  | "localDemoGeneration"
  | "developmentFreeGeneration";

const enabledByDefault: Record<ProductFeature, boolean> = {
  guestCreator: true,
  workspaceShell: true,
  projects: true,
  advancedMode: true,
  exportPipeline: false,
  portableAuth: false,
  localDemoGeneration: false,
  developmentFreeGeneration: false,
};

const envNames: Record<ProductFeature, string> = {
  guestCreator: "VITE_FEATURE_GUEST_CREATOR",
  workspaceShell: "VITE_FEATURE_WORKSPACE_SHELL",
  projects: "VITE_FEATURE_PROJECTS",
  advancedMode: "VITE_FEATURE_ADVANCED_MODE",
  exportPipeline: "VITE_FEATURE_EXPORT_PIPELINE",
  portableAuth: "VITE_FEATURE_PORTABLE_AUTH",
  localDemoGeneration: "VITE_FEATURE_LOCAL_DEMO_GENERATION",
  developmentFreeGeneration: "VITE_FEATURE_DEVELOPMENT_FREE_GENERATION",
};

export function isFeatureEnabled(feature: ProductFeature) {
  const value = import.meta.env[envNames[feature]];
  if (value === "true") return true;
  if (value === "false") return false;
  return enabledByDefault[feature];
}
