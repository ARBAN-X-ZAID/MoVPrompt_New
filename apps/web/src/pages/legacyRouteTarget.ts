export type LegacyRouteKind = "advanced" | "director-session" | "library" | "template-builder";

export function legacyRouteTarget(
  kind: LegacyRouteKind,
  search = "",
  sessionId?: string,
): string {
  if (kind === "advanced") return "/advanced";
  if (kind === "template-builder") return "/advanced/templates";
  if (kind === "director-session") {
    const query = new URLSearchParams();
    if (sessionId) query.set("session", sessionId);
    return `/advanced/history${query.size ? `?${query}` : ""}`;
  }

  const sourceQuery = new URLSearchParams(search);
  if (sourceQuery.get("tab") === "videos") return "/projects";
  return `/advanced/history${search}`;
}
