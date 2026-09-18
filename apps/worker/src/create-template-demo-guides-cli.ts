import { createCanvas } from "@napi-rs/canvas";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(new URL("../../../docs/template-demos/", import.meta.url));
mkdirSync(output, { recursive: true });
for (const demo of [
  { id: "app-service", title: "YOUR APP", lines: ["A simpler everyday", "Your service. One tap.", "Discover what is possible"] },
  { id: "salon-booking-offer", title: "YOUR SALON", lines: ["A moment just for you", "Choose your appointment", "Book your visit"] },
]) {
  const frames: string[] = [];
  for (const [index, line] of demo.lines.entries()) {
    const canvas = createCanvas(480, 854); const c = canvas.getContext("2d");
    c.fillStyle = "#171614"; c.fillRect(0, 0, 480, 854); c.strokeStyle = "#c99946"; c.strokeRect(32, 32, 416, 790);
    c.textAlign = "center"; c.fillStyle = "#c99946"; c.font = "22px sans-serif"; c.fillText(demo.title, 240, 120);
    c.fillStyle = "#292622"; c.fillRect(80, 255, 320, 280); c.strokeRect(104, 279, 272, 232);
    c.fillStyle = "#c99946"; c.font = "bold 26px sans-serif"; c.fillText(index === 2 ? "LET'S BEGIN" : demo.id === "app-service" ? "ONE TAP" : "YOUR MOMENT", 240, 410);
    c.fillStyle = "#ffffff"; c.font = "22px sans-serif"; c.fillText(line, 240, 620);
    c.fillStyle = "#c6c1b8"; c.font = "15px sans-serif"; c.fillText("Illustrative template preview", 240, 790);
    const image = `${output}${demo.id}-${index}.png`; writeFileSync(image, canvas.toBuffer("image/png")); frames.push(image);
    if (index === 0) writeFileSync(`${output}${demo.id}.jpg`, canvas.toBuffer("image/jpeg"));
  }
  const manifest = `${output}${demo.id}.txt`; writeFileSync(manifest, frames.map(p => `file '${p}'\nduration 4`).join("\n") + `\nfile '${frames[2]}'\n`);
  execFileSync(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", manifest, "-vf", "fps=24,fade=t=in:st=0:d=0.5,fade=t=out:st=11.5:d=0.5", "-t", "12", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${output}${demo.id}.mp4`]);
  for (const temporary of [...frames, manifest]) unlinkSync(temporary);
}
