const Module = require("node:module");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const load = Module._load;
const capabilities = { supported_operations: ["text-to-video"], supported_durations_seconds: [2], supported_resolutions: ["480p"] };
global.fetch = async (url) => {
 if (String(url) === "https://ai-gateway.vercel.sh/v1/models") return Response.json({data:[{id:"bytedance/seedance-v1.0-pro-fast",video_capabilities:capabilities}]});
 if (String(url) === "https://fixture.invalid/output.mp4") return new Response(fs.readFileSync(process.env.MOVPROMPT_TEST_FIXTURE), {headers:{"content-type":"video/mp4"}});
 throw new Error("Unexpected network request blocked by offline test");
};
Module._load = function(id, parent, main) {
 if (id === "ai") return { experimental_generateVideo: async (args) => {
  assert.equal(args.model, "bytedance/seedance-v1.0-pro-fast");
  assert.equal(args.maxRetries,0); assert.equal(args.n,1); assert.equal(args.duration,2);
  assert.equal(args.resolution,"480p"); assert.equal(args.generateAudio,false);
  const {data}=await args.download({url:new URL("https://fixture.invalid/output.mp4")});
  return {videos:[{uint8Array:data}]};
 }};
 return load.call(this,id,parent,main);
};
