import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createVercelGatewaySeedanceAdapter } from "../../../packages/providers/src/vercel-gateway-seedance.ts";

const dir = import.meta.dir;
const privateDir = resolve(dir, "../../../artifacts/purse-car-seedance1-8s-2026-10-14");
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const record = async (name: string, data: unknown) => writeFile(resolve(privateDir, name), JSON.stringify(data, null, 2), { mode: 0o600 });
async function main() {
  await mkdir(privateDir, { recursive: true, mode: 0o700 });
  const prompt = (await readFile(resolve(dir, "prompt-8s.txt"), "utf8")).trim();
  const image = await readFile(resolve(dir, process.argv.includes("--retry-unaccepted-transport") ? "first-frame-compact.jpg" : "first-frame.jpg"));
  if (prompt.length > 8000 || image.length > 10 * 1024 * 1024) throw new Error("input_limit_exceeded");
  const immutable = sha(JSON.stringify({ prompt, firstFrame: sha(image), duration: 8, model: "bytedance/seedance-v1.0-pro-fast", audio: false, ratio: "9:16", resolution: "720p" }));
  const seed = parseInt(immutable.slice(0, 8), 16) & 0x7fffffff;
  if (process.argv.includes("--dry-run")) { console.log(JSON.stringify({ model: "bytedance/seedance-v1.0-pro-fast", duration: 8, promptCharacters: prompt.length, seed, paidCalls: 0 })); return; }
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!apiKey) throw new Error("gateway_key_missing");
  const adapter = createVercelGatewaySeedanceAdapter({ capability: "video.cinematic", modelId: "bytedance/seedance-v1.0-pro-fast", applicationEnvironment: "local", apiKey, resolutionTier: "720p", generateAudio: false,
    resolveReferenceUrl: async () => { throw new Error("multiple_reference_mode_not_supported"); },
    resolveFirstFrame: async () => ({ type: "file", data: image.toString("base64"), mediaType: "image/jpeg" }),
  });
  if (process.argv.includes("--submit")) {
    if (process.env.MOVPROMPT_AUTHORIZE_PURSE_CAR !== "ONE_ATTEMPT") throw new Error("confirmation_missing");
    let guard = "dispatch.json";
    if (process.argv.includes("--retry-unaccepted-transport")) {
      const failure = JSON.parse(await readFile(resolve(privateDir, "failure.json"), "utf8"));
      if (await Bun.file(resolve(privateDir, "operation.json")).exists() || failure.message !== "Async video job request is too large to persist (over 300KB). Use hosted URLs instead of inline base64 data for images and references.") throw new Error("transport_retry_not_safe");
      guard = "transport-correction-dispatch.json";
    }
    await writeFile(resolve(privateDir, guard), JSON.stringify({ authorizedCalls: 1, immutable, seed, model: "bytedance/seedance-v1.0-pro-fast", duration: 8, musicAddedSeparately: true, at: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
    console.info("Submitting ONE authorized 8s Seedance 1.0 Pro Fast first-frame request. Music will be added locally. No paid retry.");
    const operation = await adapter.submit({ operationId: `purse-car-${immutable.slice(0,24)}`, userId: "local-preview", projectId: "standalone-purse-car", capability: "video.cinematic", prompt, durationSeconds: 8, aspectRatio: "9:16", resolution: "720p", generateAudio: false, seed, referenceMode: "first_frame", requiredModelId: "bytedance/seedance-v1.0-pro-fast", references: [{ objectKey: `local-first-frame/${sha(image)}.jpg`, mimeType: "image/jpeg" }], idempotencyKey: `purse-car-${immutable}` });
    await record("operation.json", operation); console.info("Provider accepted; recovery saved.");
  } else if (!process.argv.includes("--resume")) throw new Error("use_submit_or_resume");
  const operation = JSON.parse(await readFile(resolve(privateDir, "operation.json"), "utf8"));
  for (let attempt=0; attempt<120; attempt++) {
    const status = await adapter.getStatus(operation.providerRequestId);
    await record("status.json",status);
    if (attempt%6===0 || status.status === "completed" || status.status === "failed") console.info(JSON.stringify({ status: status.status, elapsedSeconds:attempt*10 }));
    if (status.status === "failed" || status.status === "cancelled") throw new Error(`provider_${status.status}:${status.errorCode ?? "unknown"}`);
    if (status.status === "completed") {
      if (!status.outputUrl) throw new Error("missing_output");
      const response=await fetch(status.outputUrl, {signal:AbortSignal.timeout(120_000)});
      if(!response.ok) throw new Error(`download_failed:${response.status}`);
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(bytes.length<1024 || Buffer.from(bytes.slice(4,8)).toString()!=="ftyp") throw new Error("output_not_mp4");
      const path=resolve(dir,"purse-car-8s-silent.mp4");
      await writeFile(path,bytes,{flag:"wx"});
      await copyFile(path,"/Users/arbaanq/Downloads/movprompt/purse-car-8s-silent.mp4");
      await writeFile(resolve(dir,"result.json"),JSON.stringify({model:"bytedance/seedance-v1.0-pro-fast",sha256:sha(bytes),paidSubmissions:1,telemetry:status.telemetry,status:"pending_visual_review_and_music"},null,2));
      console.info("Picture generated. Pending media review and separate original music.");return;
    }
    await new Promise(done=>setTimeout(done,10000));
  }
  throw new Error("poll_window_ended_resume_existing_only");
}
main().catch(async error=>{await record("failure.json",{message:error instanceof Error?error.message:String(error),at:new Date().toISOString()}).catch(()=>undefined);console.error("Preview stopped. Private recovery saved; no paid retry.");process.exitCode=1;});
