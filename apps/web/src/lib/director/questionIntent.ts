export type MediaKind = "image" | "video" | "audio" | "document";

export type MediaAsk = {
  kinds: MediaKind[];
  /** Friendly noun label, e.g. "image", "video", "image or video". */
  label: string;
};

const VERBS_EN =
  /(drop|share|send|upload|attach|paste|provide|give|add|show)/i;
const ACTION_AR = /(ارفع|أرسل|أرفق|شارك|أعطني|أضف)/;

const IMAGE_RE =
  /(image|images|photo|photos|picture|pictures|screenshot|screenshots|frame|frames|still|stills|reference|references|moodboard|mood\s*board|shot|shots|pic|pics|thumbnail|thumbnails)/i;
const VIDEO_RE = /(video|videos|clip|clips|footage|reel|reels|movie|trailer)/i;
const AUDIO_RE = /(audio|voice|sound|music|track|song|recording|voiceover)/i;
const DOC_RE = /(document|documents|file|files|pdf|docx|doc|brief|script|deck|notes?)/i;

const IMAGE_AR = /(صور|صورة|لقطة|مرجع)/;
const VIDEO_AR = /(فيديو|مقطع)/;
const AUDIO_AR = /(صوت|موسيقى|تسجيل)/;
const DOC_AR = /(ملف|مستند|وثيقة|نص)/;

function nounLabel(kinds: MediaKind[]): string {
  const map: Record<MediaKind, string> = {
    image: "image",
    video: "video",
    audio: "audio",
    document: "file",
  };
  if (kinds.length === 1) return map[kinds[0]];
  if (kinds.length === 2) return `${map[kinds[0]]} or ${map[kinds[1]]}`;
  return "media";
}

/**
 * Detect whether a Director question is asking the user to provide files.
 * Returns null when the question is not a media ask.
 */
export function detectMediaAsk(text: string): MediaAsk | null {
  if (!text) return null;
  const t = text.trim();

  const hasVerb = VERBS_EN.test(t) || ACTION_AR.test(t);
  const kinds = new Set<MediaKind>();

  if (IMAGE_RE.test(t) || IMAGE_AR.test(t)) kinds.add("image");
  if (VIDEO_RE.test(t) || VIDEO_AR.test(t)) kinds.add("video");
  if (AUDIO_RE.test(t) || AUDIO_AR.test(t)) kinds.add("audio");
  if (DOC_RE.test(t) || DOC_AR.test(t)) kinds.add("document");

  if (kinds.size === 0) return null;

  // Require either an action verb OR a strong standalone media noun
  // (e.g. "any references?" should still count).
  const strongNoun =
    /\b(references?|moodboard|mood\s*board|screenshots?|footage|clip)\b/i.test(t);
  if (!hasVerb && !strongNoun) return null;

  const list = Array.from(kinds);
  return { kinds: list, label: nounLabel(list) };
}

export function acceptAttrFor(kinds: MediaKind[]): string {
  const parts: string[] = [];
  if (kinds.includes("image")) parts.push("image/*");
  if (kinds.includes("video")) parts.push("video/*");
  if (kinds.includes("audio")) parts.push("audio/*");
  if (kinds.includes("document")) parts.push(".pdf,.docx,.txt,.md");
  return parts.join(",");
}

// ---------------------------------------------------------------------------
// Bridge 3 — Ad / commercial intent detection (Director → Ads Studio).
// Heuristic only: triggers a one-time suggestion to open Ads Studio.
// ---------------------------------------------------------------------------

const AD_RE_EN =
  /\b(ad|ads|advert|advertisement|commercial|commercials|campaign|campaigns|brand|branding|product\s*launch|launch\s*video|promo|promotional|spot|tvc|marketing|sponsored|hero\s*video|product\s*video)\b/i;
const AD_RE_AR = /(إعلان|إعلانات|حملة|تسويق|علامة\s*تجارية|منتج)/;

export function detectAdIntent(text: string): boolean {
  if (!text) return false;
  return AD_RE_EN.test(text) || AD_RE_AR.test(text);
}
