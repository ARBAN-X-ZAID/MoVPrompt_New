import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createVercelGatewaySeedanceAdapter } from "../../../packages/providers/src/vercel-gateway-seedance.ts";
import { R2Storage, r2StorageConfigFromEnv } from "../../../packages/storage/src/index.ts";

const dir=import.meta.dir;
const privateDir=resolve(dir,"../../../artifacts/photoreal-purse-car-15s-2026-10-14");
const hash=(bytes:Uint8Array|string)=>createHash("sha256").update(bytes).digest("hex");
const record=async(name:string,data:unknown)=>writeFile(resolve(privateDir,name),JSON.stringify(data,null,2),{mode:0o600});
async function main(){
  await mkdir(privateDir,{recursive:true,mode:0o700});
  const prompt=(await readFile(resolve(dir,"prompt.txt"),"utf8")).trim();
  const image=await readFile(resolve(dir,"../preview-15s/luxury-purse.png"));
  if(!prompt||prompt.length>8000)throw new Error("prompt_invalid");
  const checksum=hash(image), immutable=hash(JSON.stringify({prompt,checksum,model:"bytedance/seedance-2.5",duration:15,aspectRatio:"9:16",audio:true,resolution:"720p"}));
  const seed=parseInt(immutable.slice(0,8),16)&0x7fffffff;
  if(process.argv.includes("--dry-run")){console.info(JSON.stringify({durationSeconds:15,model:"bytedance/seedance-2.5",referenceCount:1,facePhotoUploaded:false,generateAudio:true,promptCharacters:prompt.length,seed,paidCalls:0}));return;}
  const apiKey=process.env.AI_GATEWAY_API_KEY?.trim();if(!apiKey)throw new Error("gateway_key_missing");
  let referenceUrl="";
  const adapter=createVercelGatewaySeedanceAdapter({capability:"video.cinematic",apiKey,modelId:"bytedance/seedance-2.5",applicationEnvironment:"local",resolutionTier:"720p",generateAudio:true,requestTimeoutMs:60000,
    resolveReferenceUrl:async()=>({url:referenceUrl,mediaType:"image/png"}),resolveFirstFrame:async()=>{throw new Error("reference_only");}});
  if(process.argv.includes("--submit")){
    if(process.env.MOVPROMPT_AUTHORIZE_REALISTIC_CAR!=="ONE_ATTEMPT")throw new Error("confirmation_missing");
    const guard=resolve(privateDir,"dispatch.json");if(await Bun.file(guard).exists())throw new Error("already_dispatched_no_paid_retry");
    const storage=new R2Storage(r2StorageConfigFromEnv()), objectKey=`preview-tests/photoreal-purse-car-15s-2026-10-14/${checksum}.png`;
    await storage.checkBucket(storage.assetsBucket);
    await storage.put({bucket:storage.assetsBucket,key:objectKey,body:image,contentType:"image/png",metadata:{"sha256-hex":checksum}});
    if(hash((await storage.get({bucket:storage.assetsBucket,key:objectKey,maxBytes:10*1024*1024})).body)!==checksum)throw new Error("reference_checksum_failed");
    referenceUrl=(await storage.signDownload({bucket:storage.assetsBucket,key:objectKey,expiresInSeconds:3600})).url;
    await writeFile(guard,JSON.stringify({authorizedCalls:1,immutable,seed,objectKey,referenceCount:1,facePhotoUploaded:false,duration:15,audio:true,at:new Date().toISOString()}),{flag:"wx",mode:0o600});
    console.info("Submitting ONE authorized 15s Seedance 2.5 request: purse reference only, prompt-created realistic adult, native instrumental audio. No paid retry.");
    await record("operation.json",await adapter.submit({operationId:`realistic-car-${immutable.slice(0,24)}`,userId:"local-preview",projectId:"standalone-realistic-car",capability:"video.cinematic",prompt,durationSeconds:15,aspectRatio:"9:16",resolution:"720p",generateAudio:true,seed,referenceMode:"references",requiredModelId:"bytedance/seedance-2.5",references:[{objectKey,mimeType:"image/png"}],idempotencyKey:`realistic-car-${immutable}`}));
    console.info("Provider accepted; private recovery saved.");
  }else if(!process.argv.includes("--resume"))throw new Error("use_submit_or_resume");
  const operation=JSON.parse(await readFile(resolve(privateDir,"operation.json"),"utf8"));
  for(let attempt=0;attempt<180;attempt++){
    const status=await adapter.getStatus(operation.providerRequestId);await record("status.json",status);
    if(attempt%6===0||status.status==="completed"||status.status==="failed")console.info(JSON.stringify({status:status.status,elapsedSeconds:attempt*10}));
    if(status.status==="failed"||status.status==="cancelled")throw new Error(`provider_${status.status}:${status.errorCode??"unknown"}`);
    if(status.status==="completed"){
      if(!status.outputUrl)throw new Error("output_missing");const response=await fetch(status.outputUrl,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error(`download_failed:${response.status}`);
      const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length<1024||Buffer.from(bytes.slice(4,8)).toString()!=="ftyp")throw new Error("not_mp4");
      const file=resolve(dir,"photoreal-purse-car-15s.mp4");await writeFile(file,bytes,{flag:"wx"});await copyFile(file,"/Users/arbaanq/Downloads/movprompt/photoreal-purse-car-15s.mp4");
      await writeFile(resolve(dir,"result.json"),JSON.stringify({status:"pending_media_review",sha256:hash(bytes),model:"bytedance/seedance-2.5",paidSubmissions:1,facePhotoUploaded:false,nativeAudioRequested:true,telemetry:status.telemetry},null,2));console.info("Video downloaded; pending media/audio and sampled visual review.");return;
    }
    await new Promise(done=>setTimeout(done,10000));
  }
  throw new Error("poll_window_ended_resume_only");
}
main().catch(async error=>{await record("failure.json",{message:error instanceof Error?error.message:String(error),at:new Date().toISOString()}).catch(()=>undefined);console.error("Preview stopped. Private recovery saved; no paid retry.");process.exitCode=1;});
