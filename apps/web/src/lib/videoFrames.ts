// Extract N evenly-spaced keyframes from a video File as base64 JPEG strings (no data URL prefix).
export async function extractVideoKeyframes(file: File, count = 3, maxWidth = 1024, quality = 0.7): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = async () => {
      try {
        const duration = isFinite(video.duration) ? video.duration : 0;
        if (!duration || duration < 0.1) {
          cleanup();
          return reject(new Error("Could not read video duration"));
        }
        // Pick timestamps slightly inside the bounds to avoid black first/last frames.
        const timestamps: number[] = [];
        for (let i = 0; i < count; i++) {
          const t = (duration * (i + 1)) / (count + 1);
          timestamps.push(Math.min(Math.max(t, 0.05), duration - 0.05));
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const frames: string[] = [];

        for (const t of timestamps) {
          await new Promise<void>((res, rej) => {
            const onSeeked = () => {
              video.removeEventListener("seeked", onSeeked);
              try {
                let w = video.videoWidth;
                let h = video.videoHeight;
                if (w > maxWidth) {
                  h = (h * maxWidth) / w;
                  w = maxWidth;
                }
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(video, 0, 0, w, h);
                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                frames.push(dataUrl.split(",")[1]);
                res();
              } catch (e) {
                rej(e);
              }
            };
            video.addEventListener("seeked", onSeeked);
            video.currentTime = t;
          });
        }

        cleanup();
        resolve(frames);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video"));
    };
  });
}

import { getCachedCompression, setCachedCompression } from "./imageCache";

export function compressImageFile(file: File, maxWidth = 1024, quality = 0.75): Promise<string> {
  // Per-File cache: same upload reused across analyze + generate + regen
  // skips canvas re-encoding entirely (typical save: 100-400ms per image).
  const cached = getCachedCompression(file);
  if (cached) return cached;

  const promise = new Promise<string>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = (h * maxWidth) / w;
        w = maxWidth;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      URL.revokeObjectURL(url);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });

  setCachedCompression(file, promise);
  return promise;
}
