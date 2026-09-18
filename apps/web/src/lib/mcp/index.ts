import aboutMovprompt from "./tools/about-movprompt";
import listVideoModels from "./tools/list-video-models";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

const legacyMcpManifest = {
  name: "movprompt-mcp",
  title: "MovPrompt MCP",
  version: "0.1.0",
  instructions:
    "MovPrompt exposes cinematic video prompt tooling. Use `about_movprompt` for an overview and `list_video_models` to see supported target video models (optionally filter by family).",
  auth: {
    type: "oauth-issuer",
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  },
  tools: [aboutMovprompt, listVideoModels],
};

export default legacyMcpManifest;
