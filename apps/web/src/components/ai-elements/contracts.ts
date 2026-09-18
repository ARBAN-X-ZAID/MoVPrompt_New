/**
 * Minimal UI contracts used by the presentational chat components.
 *
 * Keeping these shapes local prevents the browser bundle from depending on a
 * server-oriented AI SDK merely for TypeScript types. The portable API will
 * own any provider-specific message conversion.
 */
export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export interface FileUIPart {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
}

export interface SourceDocumentUIPart {
  type: "source-document";
  sourceId: string;
  mediaType: string;
  title: string;
  filename?: string;
}

export interface UIMessage {
  id?: string;
  role: "system" | "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
}
