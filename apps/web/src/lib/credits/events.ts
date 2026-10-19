export const CREDITS_CHANGED_EVENT = "movprompt:credits-changed";

export function notifyCreditsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
}
