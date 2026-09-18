/** Matches the database's deterministic conversion of legacy browser UUIDs. */
export async function canonicalCreatorAssetId(id: string): Promise<string> {
  if (/^[a-f0-9]{24}$/i.test(id)) return id.toLowerCase();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) throw new Error("Invalid image identity");
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id.toLowerCase())));
  return Array.from(bytes.slice(0, 12), value => value.toString(16).padStart(2, "0")).join("");
}
