/** Fetch through the authenticated API; browsers never fetch R2 directly. */
export async function downloadStoredVideo(attachmentUrl: string, filename: string): Promise<void> {
  const url = new URL(attachmentUrl);
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password) throw new Error("Invalid storage download URL");
  const response = await fetch(url.href, { credentials: "include", signal: AbortSignal.timeout(30_000) });
  if (!response.ok || response.headers.get("content-type")?.split(";", 1)[0] !== "video/mp4") throw new Error("Video download failed");
  const blob = await response.blob();
  if (!blob.size) throw new Error("Video download is empty");
  const blobUrl = URL.createObjectURL(blob);
  const revoke = URL.revokeObjectURL.bind(URL);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.rel = "noreferrer";
  anchor.hidden = true;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Give the browser time to consume the blob before releasing it.
    window.setTimeout(() => revoke(blobUrl), 1_000);
  }
}
