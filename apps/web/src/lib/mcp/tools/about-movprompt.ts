const aboutMovPromptTool = {
  name: "about_movprompt",
  title: "About MovPrompt",
  description:
    "Describes MovPrompt's template-first and Advanced workflows and approved capability families.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const text = [
      "MovPrompt — template-first AI video creation for GCC businesses and creative teams.",
      "",
      "Workflows:",
      "1. Template Mode — add a product, choose a proven campaign recipe, review the quote, and generate.",
      "2. Advanced Mode — direct approved video capabilities with prompt, reference, camera, and timing controls.",
      "",
      "Approved capability contracts include cinematic video, product-fidelity video and imagery, presenters, consented avatars and voices, speech, transcription and moderation. Provider model IDs remain server-only.",
      "",
      "Site: https://movprompt.com",
    ].join("\n");
    return { content: [{ type: "text", text }] };
  },
};

export default aboutMovPromptTool;
