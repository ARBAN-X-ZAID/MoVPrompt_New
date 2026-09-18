import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FAL_KEY = Deno.env.get("FAL_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET = "preset-previews";

// === Model registry ===
// LTX/Wan are dramatically faster than Kling. Defaults to LTX.
const FAL_MODELS = {
  "ltx-fast": {
    url: "https://queue.fal.run/fal-ai/ltx-video",
    label: "LTX (fastest, ~20s)",
    supportsDuration: false,
    supportsAspect: true,
  },
  "wan-fast": {
    url: "https://queue.fal.run/fal-ai/wan/v2.2-5b/text-to-video",
    label: "Wan 2.2 5B (~30s)",
    supportsDuration: false,
    supportsAspect: true,
  },
  "kling-std": {
    url: "https://queue.fal.run/fal-ai/kling-video/v1/standard/text-to-video",
    label: "Kling v1 Standard (~90s, best quality)",
    supportsDuration: true,
    supportsAspect: true,
  },
} as const;
type ModelKey = keyof typeof FAL_MODELS;
const DEFAULT_MODEL: ModelKey = "ltx-fast";
const isModelKey = (v: unknown): v is ModelKey =>
  typeof v === "string" && v in FAL_MODELS;

// Hand-tuned hero prompts. Each describes ONE continuous physical camera
// motion over 5 seconds — never editing-room jargon — so text-to-video
// models translate them into actual on-screen movement.
const HERO_PROMPTS: Record<string, string> = {
  // === Originals ===
  "dolly-zoom":
    "Continuous dolly-zoom over 5 seconds: camera physically pushes forward while lens zooms outward at the same rate, on a lone figure standing on a foggy cliff at sunset. Subject stays exactly the same size in frame while the background dramatically compresses around them. Single unbroken shot, no cuts, 35mm anamorphic, golden hour rim light, shallow depth of field, cinematic.",
  "bullet-time":
    "Continuous 5-second shot: camera orbits 180 degrees around a figure frozen mid-jump in a rainy alley at night, water droplets suspended motionless in the air, neon reflections on wet pavement. Subject and droplets do not move; only the camera arcs around them. Single unbroken move, no cuts, Matrix-style time freeze, cinematic.",
  "orbit-360":
    "Continuous 5-second 360-degree orbit around a vintage motorcycle parked in a desert at golden hour, dust particles drifting in the air. Camera circles the subject in one smooth unbroken motion at constant radius and height. No cuts, no edits, single continuous camera move, anamorphic lens, cinematic.",
  "crash-zoom-in":
    "Continuous 5-second aggressive crash zoom: camera rapidly punches in from a wide shot of a determined warrior to an extreme close-up of the eye, in one unbroken motion. No cuts, single continuous zoom, dramatic lighting, shallow focus, cinematic action film.",
  "whip-pan-right":
    "Continuous 5-second whip-pan: camera rotates rapidly to the right across a bustling Tokyo street at night, neon signs streaking into motion blur, ending on a quieter alley. Single unbroken horizontal pan from a fixed pivot, no cuts, cinematic.",
  "fpv-drone":
    "Continuous 5-second FPV drone shot diving down a mountain ski slope, weaving between pine trees, snow spraying behind. One unbroken forward-motion flight, no cuts, GoPro style, cinematic.",
  "levitation":
    "Continuous 5-second locked wide shot: a figure in flowing robes slowly rises off the ground in a misty forest at dawn, dust and leaves swirling upward around them. Camera does not move. Single unbroken take, no cuts, magical realism, cinematic.",
  "explosion":
    "Continuous 5-second slow-motion shot of a fireball exploding in the desert at dusk, debris flying outward, shockwave rippling across the sand. Camera holds steady on a wide locked frame. Single unbroken take, no cuts, anamorphic lens flare, cinematic Michael Bay style.",
  "disintegration":
    "Continuous 5-second locked shot: a figure slowly disintegrates into glowing particles that drift upward against a dark blue twilight sky, Marvel-style snap effect. Camera does not move. Single unbroken take, no cuts, cinematic.",
  "glitch":
    "Continuous 5-second cyberpunk portrait with progressively heavier digital glitch artifacts — RGB channel splits, scan lines, datamoshing — building over the shot. Camera holds a locked medium close-up. Single unbroken take, no cuts, neon magenta and cyan lighting, cinematic.",
  "lightning":
    "Continuous 5-second locked wide shot of a stormy mountain peak at night, lightning bolts striking repeatedly and illuminating the jagged rocks, heavy rain falling. Camera does not move. Single unbroken take, no cuts, cinematic.",
  "mix-bullet-slow":
    "Continuous 5-second slow-motion orbit around a figure firing a pistol, shell casing tumbling through the air, smoke trail behind it, golden hour backlight. Camera circles smoothly around the frozen action. Single unbroken move, no cuts, cinematic action.",

  // === Basic camera moves ===
  "dolly-in":
    "Continuous 5-second dolly-in: camera glides smoothly forward toward a lone figure seated at a candlelit table in a dim restaurant, starting at a wide shot, ending at a tight medium close-up. Camera is mounted on dolly tracks moving in a perfectly straight line, no zoom. Single unbroken motion, no cuts, 35mm anamorphic, cinematic.",
  "dolly-out":
    "Continuous 5-second dolly-out: camera retreats smoothly backward in one unbroken motion, starting on a tight shot of a lone violinist in a candlelit cathedral, slowly revealing empty pews, then the vaulted ceiling, ending wide. Locked horizon, steady glide on dolly tracks, no zoom, no cuts, single continuous camera move, 35mm anamorphic, cinematic.",
  "push-in":
    "Continuous 5-second slow push-in: camera moves deliberately forward toward a woman staring out a rain-streaked window at dusk. Begins at a wide shot, ends in a tight close-up of her eyes. Smooth dolly motion, no zoom, no cuts, single continuous shot, 35mm anamorphic, cinematic.",
  "pull-out":
    "Continuous 5-second slow pull-out: camera glides backward away from a child holding a glowing lantern in a snowy field at twilight, gradually revealing the vast empty landscape and a dark forest in the distance. Smooth dolly motion, no zoom, no cuts, single continuous shot, cinematic.",
  "pan-left":
    "Continuous 5-second pan-left: camera body stays planted on a tripod, lens rotates smoothly to the left across a sun-drenched coastal cliffside, starting on crashing waves and ending on a lone lighthouse. Single unbroken horizontal pan, no cuts, no zoom, 35mm anamorphic, cinematic.",
  "pan-right":
    "Continuous 5-second pan-right: camera body stays planted on a tripod, lens rotates smoothly to the right across a neon-lit Hong Kong rooftop at night, starting on a glowing sign and ending on the sprawling city skyline. Single unbroken horizontal pan, no cuts, no zoom, cinematic.",
  "tilt-up":
    "Continuous 5-second tilt-up: camera body stays planted, lens angles smoothly upward in one unbroken motion, starting framed on the boots of a knight in armor, slowly revealing the chest plate, then the helmet, ending with the towering figure against a stormy sky. Single continuous tilt on a fixed pivot, no cuts, no zoom, 35mm anamorphic, cinematic.",
  "tilt-down":
    "Continuous 5-second tilt-down: camera body stays planted, lens angles smoothly downward in one unbroken motion, starting on the top of a vast skyscraper at sunset, gliding down the glass facade, ending on the bustling street below. Single continuous tilt on a fixed pivot, no cuts, no zoom, cinematic.",
  "pedestal-up":
    "Continuous 5-second pedestal-up: the entire camera body rises straight upward on a vertical column over 5 seconds, starting at knee height of a standing samurai in a misty bamboo grove and ending at eye level. Lens stays level, no tilt, no zoom. Single unbroken vertical move, no cuts, cinematic.",
  "pedestal-down":
    "Continuous 5-second pedestal-down: the entire camera body lowers straight downward on a vertical column over 5 seconds, starting at the eye-level of a child reaching upward and ending kneeling beside a small puppy on the floor. Lens stays level, no tilt, no zoom. Single unbroken vertical move, no cuts, cinematic.",
  "zoom-in":
    "Continuous 5-second optical zoom-in: camera body stays completely still on a tripod, lens focal length slowly tightens from a wide shot of a foggy forest clearing to a tight close-up of a single illuminated red flower at the center. No camera movement, no dolly, only the lens zooming. Single unbroken zoom, no cuts, cinematic.",
  "zoom-out":
    "Continuous 5-second optical zoom-out: camera body stays completely still on a tripod, lens focal length slowly widens from a tight close-up of a chess piece to a wide shot revealing the full board and two players in a smoky parlor. No camera movement, no dolly, only the lens zooming. Single unbroken zoom, no cuts, cinematic.",
  "snap-zoom":
    "Continuous 5-second snap-zoom: camera holds locked on a man at a desk for the first second, then the lens punches in rapidly to an extreme close-up of his shocked eyes and holds. Single unbroken shot, no cuts, no dolly motion, just the lens zooming aggressively, cinematic.",
  "tracking":
    "Continuous 5-second tracking shot: camera moves smoothly sideways alongside a runner sprinting through a sunlit forest, maintaining the same speed and a constant medium-wide framing of the runner in profile. Single unbroken parallel motion, no cuts, cinematic.",
  "follow":
    "Continuous 5-second following shot: camera moves smoothly behind a figure in a long coat walking down a rain-slicked alley at night, holding a steady distance. Camera tracks forward at the subject's exact pace. Single unbroken motion, no cuts, cinematic.",
  "drift":
    "Continuous 5-second slow horizontal drift: camera floats gently sideways on a steadicam through a sunlit field of tall grass at golden hour, gauzy and dreamlike. Single unbroken lateral motion, no cuts, cinematic.",
  "reveal":
    "Continuous 5-second reveal shot: camera glides slowly to the right from behind a stone column, gradually uncovering a hidden underground chamber lit by a single shaft of light falling on an ancient sword on a pedestal. Single unbroken sideways motion, no cuts, cinematic.",
  "static":
    "Continuous 5-second locked-off shot: camera completely motionless on a tripod, framing a wide symmetrical view of an empty diner at dawn through the front window, soft natural light. No camera movement at all. Single unbroken take, no cuts, cinematic.",
  "no-movement":
    "Continuous 5-second locked-off shot: camera completely still, holding a centered medium framing of a ballet dancer rehearsing alone in a sunlit studio. The dancer moves expressively but the camera does not move at all. Single unbroken take, no cuts, cinematic.",
  "natural":
    "Continuous 5-second shot with subtle organic camera life — very gentle, almost imperceptible breathing motion as if held by a calm operator — framing a barista pouring coffee at a small cafe counter. No deliberate move, no cuts, single continuous take, documentary feel, cinematic.",
  "shake":
    "Continuous 5-second shot with sharp camera vibration as if from a nearby explosion: camera frames a soldier reacting in a war-torn street, debris falling, the frame jolting with hard impacts throughout. Single unbroken take, no cuts, cinematic.",
  "handheld":
    "Continuous 5-second handheld shot: loose, human-held camera with natural sway and small adjustments, framing a chef working at a hot kitchen line, steam rising. Single unbroken take, no cuts, vérité feel, cinematic.",
  "swivel":
    "Continuous 5-second swivel: camera spins smoothly around its own optical axis (roll), framed on a man standing in the center of an empty warehouse. The world rotates around the centered subject. Single unbroken roll, no cuts, cinematic.",

  // === Epic camera moves ===
  "dolly-zoom-in":
    "Continuous 5-second dolly-zoom in: camera physically pushes forward toward a man standing on a clifftop while the lens zooms outward at the same rate. Subject stays exactly the same size in frame while the background expands and stretches dramatically around him. Single unbroken motion, no cuts, Hitchcock vertigo effect, 35mm anamorphic, cinematic.",
  "dolly-zoom-out":
    "Continuous 5-second dolly-zoom out: camera physically pulls backward away from a woman standing in a hallway while the lens zooms inward at the same rate. Subject stays exactly the same size in frame while the background compresses and rushes inward around her. Single unbroken motion, no cuts, realization moment, 35mm anamorphic, cinematic.",
  "crash-zoom-out":
    "Continuous 5-second aggressive crash zoom-out: camera holds locked, lens rapidly pulls focal length wide from an extreme close-up of a pocket watch to a wide shot revealing a vast empty train platform. Single unbroken zoom motion, no cuts, dramatic, cinematic.",
  "arc-left":
    "Continuous 5-second arc-left: camera follows a curving path around a samurai standing in a moonlit bamboo grove, sweeping from his right side around to his front. Smooth constant-radius arc, single unbroken motion, no cuts, cinematic.",
  "arc-right":
    "Continuous 5-second arc-right: camera follows a curving path around a lone astronaut standing in a desert under a red sky, sweeping from her left side around to her front. Smooth constant-radius arc, single unbroken motion, no cuts, cinematic.",
  "crane-up":
    "Continuous 5-second crane-up: camera rises high into the air on a crane arm while gently tilting downward to keep a marching army in frame, starting at ground level and ending in a sweeping high overhead shot. Single unbroken vertical move, no cuts, epic reveal, cinematic.",
  "crane-down":
    "Continuous 5-second crane-down: camera descends from a high overhead view of a misty cathedral courtyard down toward a single robed figure standing at the center, ending at eye level. Smooth crane arm motion, single unbroken move, no cuts, cinematic.",
  "orbit-left":
    "Continuous 5-second orbit-left: camera circles smoothly counterclockwise around a hooded figure standing in a glowing magic circle on a stone floor. Constant radius and height. Single unbroken arc, no cuts, cinematic.",
  "orbit-right":
    "Continuous 5-second orbit-right: camera circles smoothly clockwise around a vintage sports car parked in a neon-lit garage, headlights on. Constant radius and height. Single unbroken arc, no cuts, cinematic.",
  "whip-pan-left":
    "Continuous 5-second whip-pan: camera rotates rapidly to the left across a bustling Marrakesh marketplace at golden hour, market stalls streaking into motion blur, ending on a quiet courtyard. Single unbroken horizontal pan from a fixed pivot, no cuts, cinematic.",
  "rack-focus":
    "Continuous 5-second locked shot: camera completely still, framing a foreground hand holding a small key in sharp focus against a soft-blurred background of a man at a doorway. Around the midpoint, focus shifts smoothly from the key to the man, who comes into sharp clarity while the key blurs. Single unbroken take, no cuts, only the focus changes, cinematic.",
  "steadicam":
    "Continuous 5-second steadicam shot: camera glides smoothly forward through a busy backstage corridor following a performer walking toward the stage, weaving past crew members. Buttery smooth long take, single unbroken motion, no cuts, cinematic.",
  "dutch-angle":
    "Continuous 5-second locked shot held at a strong dutch tilt — camera roll fixed at roughly 20 degrees off horizontal — framing a detective standing in a flickering neon-lit alley. The frame stays tilted throughout. Single unbroken take, no cuts, suspenseful, cinematic.",
  "birds-eye":
    "Continuous 5-second locked overhead shot: camera mounted directly above looking straight down at a city intersection at night, cars and pedestrians moving through the frame. Camera does not move at all. Single unbroken top-down take, no cuts, cinematic.",
  "worms-eye":
    "Continuous 5-second locked shot: camera placed on the ground looking straight up at a towering skyscraper between rows of trees, clouds drifting overhead. Camera does not move. Single unbroken upward-looking take, no cuts, cinematic.",
  "jib-up":
    "Continuous 5-second jib-up: camera rises smoothly upward on a jib arm with a slight forward push, starting at eye level of a couple embracing on a beach at sunset and ending in a sweeping wide overhead view of the shoreline. Single unbroken lyrical move, no cuts, cinematic.",
  "jib-down":
    "Continuous 5-second jib-down: camera descends smoothly on a jib arm from a high overhead view of an autumn garden down to a child kneeling beside a small fountain, settling at eye level. Single unbroken move, no cuts, cinematic.",
};

const SCENE_HINTS: Record<string, string> = {
  basic: "a lone figure walking down a city street at dusk",
  epic: "a vast canyon at golden hour with sweeping vistas",
  effects: "a dancer in a dark studio with a single key light",
  pulse: "a sports car drifting on a wet street at night",
  mix: "a rain-soaked alley with neon signs and reflective puddles",
};

const CAMERA_GROUPS = new Set(["basic", "epic"]);

function buildDynamicPrompt(opts: {
  label: string;
  description: string;
  bestFor: string;
  groupId: string;
}): string {
  const isCameraMove = CAMERA_GROUPS.has(opts.groupId);
  const sceneHint = SCENE_HINTS[opts.groupId] ?? "a cinematic environment with dramatic lighting";

  if (isCameraMove) {
    return `Continuous single-shot 5-second video. The camera performs ONE unbroken "${opts.label}" move from start to finish — no cuts, no edits, no shot changes, no transitions.

Move definition: ${opts.description}
What the audience should see: ${opts.bestFor}

Scene: ${sceneHint}

Constraints: single continuous physical camera move executed smoothly over the full 5 seconds, locked timing, 35mm anamorphic, dramatic lighting, photoreal, high detail. The "${opts.label}" motion must be unmistakable from the first frame and dominate the shot. Do not interpret "${opts.label}" as an editing term — render it as actual on-screen camera movement.`;
  }

  return `Cinematic 5-second video that clearly demonstrates a "${opts.label}" visual effect.
The effect must be the visible focus of the shot.

Effect description: ${opts.description}
Best used for: ${opts.bestFor}

Scene: ${sceneHint}

Style: 35mm anamorphic, dramatic lighting, shallow depth of field, photoreal, high detail. Single continuous shot, no cuts, no edits. Subject and framing chosen to make the "${opts.label}" effect unmistakable from the first frame.`;
}

// Camera moves that LTX consistently mishandles (vertical moves, reverse
// moves, dolly-zoom variants, focus pulls). When the admin selects LTX for
// these, we transparently upgrade to Wan and surface the swap in the
// response so the UI can show a small note.
const HARD_FOR_LTX = new Set([
  "dolly-out", "pull-out",
  "tilt-up", "tilt-down",
  "pedestal-up", "pedestal-down",
  "crash-zoom-out",
  "crane-up", "crane-down",
  "jib-up", "jib-down",
  "dolly-zoom", "dolly-zoom-in", "dolly-zoom-out",
  "rack-focus",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: json({ ok: false, error: "Unauthorized", code: "unauth" }, 401) };
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return { error: json({ ok: false, error: "Unauthorized", code: "unauth" }, 401) };
  }
  const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleErr || !isAdmin) {
    return { error: json({ ok: false, error: "Admin only", code: "forbidden" }, 403) };
  }
  return { userId: userData.user.id };
}

const SLUG_RE = /^[a-z0-9-]+$/;

async function resolvePrompt(
  presetId: string,
  body: Record<string, unknown>,
): Promise<{ prompt: string } | { error: string }> {
  if (HERO_PROMPTS[presetId]) {
    return { prompt: HERO_PROMPTS[presetId] };
  }

  const clientLabel = typeof body.label === "string" ? body.label.trim() : "";
  const clientDesc = typeof body.description === "string" ? body.description.trim() : "";
  const clientBest = typeof body.bestFor === "string" ? body.bestFor.trim() : "";
  const clientGroup = typeof body.groupId === "string" ? body.groupId.trim() : "";

  if (clientLabel && clientDesc) {
    return {
      prompt: buildDynamicPrompt({
        label: clientLabel,
        description: clientDesc,
        bestFor: clientBest || clientLabel,
        groupId: clientGroup || "effects",
      }),
    };
  }

  // DB fallback for custom presets
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await admin
    .from("custom_presets")
    .select("label, description, best_for, group_id")
    .eq("id", presetId)
    .maybeSingle();
  if (error) return { error: `DB lookup failed: ${error.message}` };
  if (!data) return { error: `Unknown presetId: ${presetId}` };
  if (!data.label || !data.description) {
    return { error: `Preset "${presetId}" missing label/description` };
  }
  return {
    prompt: buildDynamicPrompt({
      label: data.label,
      description: data.description,
      bestFor: data.best_for || data.label,
      groupId: data.group_id || "effects",
    }),
  };
}

function buildFalBody(model: ModelKey, prompt: string) {
  const cfg = FAL_MODELS[model];
  const body: Record<string, unknown> = { prompt };
  if (cfg.supportsAspect) body.aspect_ratio = "16:9";
  if (cfg.supportsDuration) body.duration = "5";
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!FAL_KEY) {
      return json({ ok: false, error: "FAL_KEY not configured", code: "no_key" }, 500);
    }

    const auth = await authAdmin(req);
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "submit");
    const model: ModelKey = isModelKey(body?.model) ? body.model : DEFAULT_MODEL;
    const modelLabel = FAL_MODELS[model].label;

    // === SUBMIT ===
    if (action === "submit") {
      const presetId = String(body?.presetId ?? "");
      if (!SLUG_RE.test(presetId)) {
        return json({ ok: false, error: `Invalid presetId: ${presetId}`, code: "bad_input" }, 400);
      }

      // Auto-upgrade LTX → Wan for camera moves LTX consistently mishandles.
      const requestedModel: ModelKey = model;
      const effectiveModel: ModelKey =
        model === "ltx-fast" && HARD_FOR_LTX.has(presetId) ? "wan-fast" : model;
      const upgraded = effectiveModel !== requestedModel;
      const effectiveLabel = FAL_MODELS[effectiveModel].label;

      const resolved = await resolvePrompt(presetId, body);
      if ("error" in resolved) {
        return json({ ok: false, error: resolved.error, code: "bad_input" }, 400);
      }

      const submitRes = await fetch(FAL_MODELS[effectiveModel].url, {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildFalBody(effectiveModel, resolved.prompt)),
      });
      if (submitRes.status === 401) {
        return json({ ok: false, error: "Invalid FAL_KEY", code: "fal_unauth", model: effectiveModel }, 502);
      }
      if (submitRes.status === 402) {
        return json({ ok: false, error: "Fal.ai credits exhausted", code: "no_credits", model: effectiveModel }, 402);
      }
      if (submitRes.status === 429) {
        return json({ ok: false, error: "Fal.ai rate limit hit", code: "rate_limit", model: effectiveModel }, 429);
      }
      if (!submitRes.ok) {
        const text = await submitRes.text();
        return json({ ok: false, error: `Fal submit failed [${effectiveLabel}] (${submitRes.status}): ${text}`, code: "fal_error", model: effectiveModel }, 502);
      }
      const submit = await submitRes.json();
      return json({
        ok: true,
        model: effectiveModel,
        modelLabel: effectiveLabel,
        requestedModel,
        effectiveModel,
        upgraded,
        upgradeReason: upgraded
          ? "LTX struggles with this camera move; auto-upgraded to Wan for accuracy."
          : null,
        requestId: submit.request_id,
        statusUrl: submit.status_url,
        responseUrl: submit.response_url,
      });
    }

    // === POLL ===
    if (action === "poll") {
      const presetId = String(body?.presetId ?? "");
      const statusUrl = String(body?.statusUrl ?? "");
      const responseUrl = String(body?.responseUrl ?? "");
      if (!SLUG_RE.test(presetId) || !statusUrl || !responseUrl) {
        return json({ ok: false, error: "Missing fields", code: "bad_input" }, 400);
      }

      const statusRes = await fetch(statusUrl, {
        headers: { Authorization: `Key ${FAL_KEY}` },
      });
      if (!statusRes.ok) {
        const text = await statusRes.text();
        return json({ ok: false, error: `Status check failed [${modelLabel}] (${statusRes.status}): ${text}`, code: "fal_error", model }, 502);
      }
      const statusData = await statusRes.json();

      if (statusData.status === "FAILED" || statusData.status === "ERROR") {
        return json({ ok: false, error: `Fal job failed [${modelLabel}]: ${JSON.stringify(statusData)}`, code: "fal_error", model }, 502);
      }
      if (statusData.status !== "COMPLETED") {
        return json({ ok: true, status: "pending", falStatus: statusData.status, model });
      }

      const finalRes = await fetch(responseUrl, {
        headers: { Authorization: `Key ${FAL_KEY}` },
      });
      if (!finalRes.ok) {
        return json({ ok: false, error: `Result fetch failed [${modelLabel}] (${finalRes.status})`, code: "fal_error", model }, 502);
      }
      const result = await finalRes.json();
      // Different models return slightly different shapes; try common locations.
      const videoUrl: string | undefined =
        result?.video?.url ??
        result?.videos?.[0]?.url ??
        result?.output?.video?.url ??
        result?.output?.[0]?.url;
      if (!videoUrl) {
        return json({ ok: false, error: `Fal result missing video url [${modelLabel}]`, code: "fal_error", model }, 502);
      }

      const videoRes = await fetch(videoUrl);
      if (!videoRes.ok) {
        return json({ ok: false, error: `Video download failed (${videoRes.status})`, code: "download", model }, 502);
      }
      const videoBytes = new Uint8Array(await videoRes.arrayBuffer());

      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const path = `${presetId}.mp4`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, videoBytes, {
        upsert: true,
        contentType: "video/mp4",
        cacheControl: "3600",
      });
      if (upErr) {
        return json({ ok: false, error: `Upload failed: ${upErr.message}`, code: "upload" }, 500);
      }
      // Record which model generated this preview (best-effort; don't fail the request).
      const { error: metaErr } = await admin.from("preset_preview_meta").upsert({
        preset_id: presetId,
        preview_model: model,
        generated_at: new Date().toISOString(),
        generated_by: auth.userId ?? null,
      });
      if (metaErr) console.error("preset_preview_meta upsert failed", metaErr);
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
      return json({
        ok: true,
        status: "done",
        presetId,
        model,
        sizeBytes: videoBytes.byteLength,
        publicUrl: pub.publicUrl,
      });
    }

    return json({ ok: false, error: `Unknown action: ${action}`, code: "bad_input" }, 400);
  } catch (e) {
    console.error("generate-preset-preview error", e);
    return json({ ok: false, error: (e as Error).message, code: "internal" }, 500);
  }
});
