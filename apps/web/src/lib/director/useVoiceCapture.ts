import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VoiceState = "idle" | "recording" | "transcribing" | "error";

type Options = {
  userId: string | null;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
};

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* ignore */
    }
  }
  return "";
}

function extFromMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

export function useVoiceCapture({ userId, onTranscript, onError }: Options) {
  const [state, setState] = useState<VoiceState>("idle");
  const [level, setLevel] = useState(0); // 0..1 mic activity
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const mimeRef = useRef<string>("");

  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      try {
        void audioCtxRef.current.close();
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const start = useCallback(async () => {
    if (!supported) {
      onError?.("Voice capture isn't supported in this browser.");
      setState("error");
      return;
    }
    if (!userId) {
      onError?.("Sign in to use voice input.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mime = pickMimeType();
      mimeRef.current = mime;
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start(250);

      // Live level meter for UI feedback
      try {
        const AC: typeof AudioContext =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setLevel(Math.min(1, rms * 3));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* meter is optional */
      }

      setState("recording");
    } catch (err: any) {
      teardown();
      setState("error");
      const msg =
        err?.name === "NotAllowedError"
          ? "Microphone access was blocked. Enable it in your browser settings."
          : err?.message || "Could not access the microphone.";
      onError?.(msg);
    }
  }, [supported, userId, onError, teardown]);

  const stop = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") {
      teardown();
      setState("idle");
      return;
    }
    setState("transcribing");
    const mime = mimeRef.current || rec.mimeType || "audio/webm";

    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mime });
        resolve(b);
      };
      try {
        rec.stop();
      } catch {
        resolve(new Blob(chunksRef.current, { type: mime }));
      }
    });
    teardown();

    if (blob.size < 800) {
      setState("idle");
      onError?.("Didn't catch anything — try again.");
      return;
    }

    try {
      const path = `${userId}/voice/${crypto.randomUUID()}.${extFromMime(mime)}`;
      const { error: upErr } = await supabase.storage
        .from("director-uploads")
        .upload(path, blob, { contentType: mime, upsert: false });
      if (upErr) throw upErr;

      const { data, error } = await supabase.functions.invoke("transcribe-audio", {
        body: { storage_path: path },
      });
      if (error) throw error;
      const text = (data as any)?.transcript?.trim?.() || "";
      if (!text) {
        onError?.("Couldn't transcribe that — try again.");
        setState("idle");
        return;
      }
      onTranscript(text);
      setState("idle");
    } catch (err: any) {
      setState("error");
      onError?.(err?.message || "Transcription failed.");
    }
  }, [userId, onTranscript, onError, teardown]);

  const cancel = useCallback(() => {
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    teardown();
    setState("idle");
  }, [teardown]);

  return { state, level, supported, start, stop, cancel };
}
