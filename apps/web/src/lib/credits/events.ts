export const CREDITS_CHANGED_EVENT = "movprompt:credits-changed";

export function notifyCreditsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
}

export const OPEN_TOP_UP_EVENT = "movprompt:open-top-up";

/** Opens the single top-up dialog mounted at the app root, from any screen. */
export function openTopUpDialog(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_TOP_UP_EVENT));
}
