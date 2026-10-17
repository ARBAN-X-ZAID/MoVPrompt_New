import { writeFile, readFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";

// Original four-bar instrumental score, authored locally. No third-party recording.
const rate=48000, duration=8, length=rate*duration;
const signal=new Float64Array(length);
const frequency=(midi:number)=>440*Math.pow(2,(midi-69)/12);
function note(start:number,seconds:number,midi:number,volume:number,kind:"keys"|"bass") {
  const f=frequency(midi);
  for(let i=0;i<seconds*rate && start*rate+i<length;i++) {
    const t=i/rate, attack=Math.min(1,t/.008), release=Math.min(1,(seconds-t)/.1);
    const envelope=attack*release*Math.exp(-t*(kind==="keys"?2:1.1));
    const wave=Math.sin(2*Math.PI*f*t)+.25*Math.sin(4*Math.PI*f*t)+.08*Math.sin(6*Math.PI*f*t);
    signal[Math.floor(start*rate)+i]+=volume*envelope*wave;
  }
}
const chords=[[60,63,67,70],[65,68,72,75],[56,60,63,67],[55,59,62,65]];
for(let bar=0;bar<4;bar++) {
  for(const offset of [0,.75,1.5]) for(const midi of chords[bar]!) note(bar*2+offset,.48,midi,.047,"keys");
  for(const [offset,midi] of [[0,chords[bar]![0]-24],[.75,chords[bar]![0]-24],[1.5,chords[bar]![2]-24]]) note(bar*2+offset,.36,midi,.13,"bass");
}
let random=1; const noise=()=>{random=(1664525*random+1013904223)>>>0;return random/2147483648-1;};
for(let beat=0;beat<16;beat++) {
  const start=beat*.5;
  for(let i=0;i<.22*rate && start*rate+i<length;i++) {const t=i/rate;signal[Math.floor(start*rate)+i]+=.3*Math.exp(-t*25)*Math.sin(2*Math.PI*(48*t+2.1*(1-Math.exp(-t*28))));}
  if(beat%2===1) for(let i=0;i<.12*rate;i++){const t=i/rate;signal[Math.floor(start*rate)+i]+=.065*noise()*Math.exp(-t*42);}
  for(const offset of [0,.25]) for(let i=0;i<.045*rate && (start+offset)*rate+i<length;i++) {const t=i/rate;signal[Math.floor((start+offset)*rate)+i]+=.022*noise()*Math.exp(-t*110);}
}
const bytes=Buffer.alloc(44+length*4);
bytes.write("RIFF",0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write("WAVEfmt ",8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*4,28);bytes.writeUInt16LE(4,32);bytes.writeUInt16LE(16,34);bytes.write("data",36);bytes.writeUInt32LE(length*4,40);
for(let i=0;i<length;i++){const t=i/rate,fade=Math.min(1,t/.025,(duration-t)/.18),sample=Math.round(Math.tanh(signal[i]!)*fade*26000);bytes.writeInt16LE(sample,44+i*4);bytes.writeInt16LE(sample,46+i*4);}
await writeFile(resolve(import.meta.dir,"original-fashion-score.wav"),bytes);
const output=resolve(import.meta.dir,"purse-car-8s-with-music-portrait.mp4");
const process=Bun.spawn(["ffmpeg","-hide_banner","-loglevel","error","-n","-i",resolve(import.meta.dir,"purse-car-8s-silent.mp4"),"-i",resolve(import.meta.dir,"original-fashion-score.wav"),"-map","0:v:0","-map","1:a:0","-vf","scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280","-af","volume=1.5","-threads","1","-c:v","libx264","-preset","veryfast","-crf","16","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-t","8","-movflags","+faststart",output],{stderr:"pipe"});
const stderr=await new Response(process.stderr).text();if(await process.exited!==0)throw new Error(stderr);
await copyFile(output,"/Users/arbaanq/Downloads/movprompt/purse-car-8s-with-music-portrait.mp4");
console.info(JSON.stringify({output,music:"Original locally authored 120 BPM instrumental; not Seedance-generated",bytes:(await readFile(output)).length}));
