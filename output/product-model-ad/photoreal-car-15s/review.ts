import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const dir=import.meta.dir;
const file=resolve(dir,"photoreal-purse-car-15s.mp4");
async function run(args:string[]){const proc=Bun.spawn(args,{stdout:"pipe",stderr:"pipe"});const [stdout,stderr,code]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);if(code!==0)throw new Error(`media_tool_failed:${stderr.slice(-500)}`);return {stdout,stderr};}
const media=JSON.parse((await run(["ffprobe","-v","error","-show_entries","format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels","-of","json",file])).stdout);
const video=media.streams.find((s:{codec_type:string})=>s.codec_type==="video"),audio=media.streams.find((s:{codec_type:string})=>s.codec_type==="audio");
if(!video||Math.abs(Number(media.format.duration)-15)>.2||Math.abs(video.width/video.height-9/16)>.002)throw new Error("video_contract_failed");
if(!audio)throw new Error("requested_audio_missing");
await run(["ffmpeg","-hide_banner","-loglevel","error","-n","-i",file,"-vf","fps=1/1.8,scale=180:320,tile=4x2","-frames:v","1",resolve(dir,"review-frames.jpg")]);
for(const seconds of [3,6,10,14])await run(["ffmpeg","-hide_banner","-loglevel","error","-n","-ss",String(seconds),"-i",file,"-frames:v","1",resolve(dir,`frame-${seconds}s.jpg`)]);
const freeze=await run(["ffmpeg","-hide_banner","-i",file,"-vf","freezedetect=n=0.001:d=0.8","-an","-f","null","-"]);
const volume=await run(["ffmpeg","-hide_banner","-i",file,"-af","volumedetect","-vn","-f","null","-"]);
const result={media,freezeEvents:freeze.stderr.split("\n").filter(line=>line.includes("freeze_")),audioLevels:volume.stderr.split("\n").filter(line=>/mean_volume|max_volume/.test(line)),nativeAudio:true,facePhotoUploaded:false};
await writeFile(resolve(dir,"media-review.json"),JSON.stringify(result,null,2));console.info(JSON.stringify(result));
