/** Legacy role flags are not owner authorization. Deploy this retirement guard
 * before enabling the portable admin workspace; rollback requires code review. */
export function legacyAdminCutover(req: Request): Response | null {
  if (req.method === "OPTIONS") return null;
  return new Response(JSON.stringify({ error: "Legacy administration has been retired. Use the owner workspace.", code: "legacy_admin_retired" }), {
    status: 410,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
  });
}
