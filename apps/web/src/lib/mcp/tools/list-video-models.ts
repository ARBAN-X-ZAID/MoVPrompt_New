const approvedCapabilities = [
  { alias: "video.cinematic", kind: "video" },
  { alias: "video.product_fidelity", kind: "video" },
  { alias: "image.product", kind: "image" },
  { alias: "presenter.ai_ugc", kind: "presenter" },
  { alias: "avatar.enroll", kind: "avatar" },
  { alias: "avatar.perform", kind: "avatar" },
  { alias: "voice.clone", kind: "voice" },
  { alias: "speech.generate", kind: "speech" },
  { alias: "speech.lip_sync", kind: "speech" },
  { alias: "media.transcribe", kind: "media" },
  { alias: "media.moderate", kind: "media" },
] as const;

const listCapabilitiesTool = {
  name: "list_approved_capabilities",
  title: "List approved capabilities",
  description:
    "Lists the stable capability aliases MovPrompt may use without exposing raw provider model IDs.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    return {
      content: [{ type: "text", text: JSON.stringify(approvedCapabilities, null, 2) }],
      structuredContent: { capabilities: approvedCapabilities },
    };
  },
};

export default listCapabilitiesTool;
