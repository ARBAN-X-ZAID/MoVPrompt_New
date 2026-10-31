/** Return targets are same-app paths only; never follow an absolute or protocol-relative URL. */
export function safeReturnTo(value: string | null | undefined, fallback: string) {
  return value && /^\/admin(\/|\?|$)/.test(value) && !value.startsWith("//") ? value : fallback;
}

/** Link to a detail page and remember the list, filters and page it was opened from. */
export function withReturnTo(path: string, from: { pathname: string; search: string }) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(`${from.pathname}${from.search}`)}`;
}
