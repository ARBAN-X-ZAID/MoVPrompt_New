// Split a single image attachment (storyboard contact sheet) into N×M panels.
// Each panel is uploaded as its own attachment with role: "storyboard" and a
// 1-based shot_index. All panels share the source's parent_storage_path so the
// UI can collapse them back into a single source reference.

import { uploadAndSign, requireUserId, type Attachment } from "./ingest";

export type GridDims = { cols: number; rows: number };

const MAX_PANEL_WIDTH = 1024;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
}

/** Heuristic: a near-square image is likely a contact-sheet candidate. */
export function looksLikeStoryboardCandidate(width: number, height: number): boolean {
  if (!width || !height) return false;
  const ratio = width / height;
  return ratio >= 0.75 && ratio <= 1.35 && width >= 600;
}

/**
 * Split the source image at `sourceUrl` into `cols × rows` panels.
 * Returns one Attachment per cell, in reading order (left→right, top→bottom),
 * with shot_index 1..N.
 */
export async function splitImageGrid(
  sourceUrl: string,
  sourceName: string,
  parentStoragePath: string | undefined,
  dims: GridDims,
): Promise<Attachment[]> {
  const { cols, rows } = dims;
  if (cols < 1 || rows < 1 || cols * rows > 16) {
    throw new Error("Grid must be between 1×1 and at most 16 panels");
  }
  const uid = await requireUserId();
  const img = await loadImage(sourceUrl);

  const cellW = Math.floor(img.naturalWidth / cols);
  const cellH = Math.floor(img.naturalHeight / rows);
  if (cellW < 64 || cellH < 64) {
    throw new Error("Each panel would be too small to be useful");
  }

  // Scale cells down if huge to keep upload sizes reasonable.
  const scale = cellW > MAX_PANEL_WIDTH ? MAX_PANEL_WIDTH / cellW : 1;
  const outW = Math.round(cellW * scale);
  const outH = Math.round(cellH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const baseName = sourceName.replace(/\.[a-zA-Z0-9]+$/, "");
  const out: Attachment[] = [];
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      idx++;
      ctx.clearRect(0, 0, outW, outH);
      ctx.drawImage(img, c * cellW, r * cellH, cellW, cellH, 0, 0, outW, outH);
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Could not encode panel"))),
          "image/jpeg",
          0.88,
        ),
      );
      const name = `${baseName}.panel-${idx}.jpg`;
      const { storage_path, url } = await uploadAndSign(blob, uid, name, "image/jpeg");
      out.push({
        kind: "image",
        name: `${baseName} · shot ${idx}/${cols * rows}`,
        url,
        storage_path,
        role: "storyboard",
        shot_index: idx,
        parent_storage_path: parentStoragePath,
        moderation: { state: "ok" }, // panels inherit moderation from the source
      });
    }
  }
  return out;
}
