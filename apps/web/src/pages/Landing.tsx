import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useInView,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import {
  Camera,
  ArrowLeftRight,
  LayoutGrid,
  Clapperboard,
  Menu,
  X,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Upload,
  Sparkles,
  FileText,
  Film,
} from "lucide-react";
import { Seo } from "@/components/Seo";
import { cn } from "@/lib/utils";

/* ============================================================
   MovPrompt — Cinematic 3D Parallax Landing
   Dark theme · Space Grotesk display · Signal Amber accent
   ============================================================ */

const NAV_LINKS: { href: string; label: string }[] = [];


const MODELS = ["Kling", "Veo", "Seedance", "Pika", "Luma", "Hailuo", "Wan"];

const FEATURES = [
  {
    icon: Clapperboard,
    title: "AI Director",
    body:
      "An agentic director for your scenes. Chat through your vision and it generates images, video, and full storyboards — directing camera, light, and motion end-to-end.",
    flagship: true,
  },
  {
    icon: Camera,
    title: "Single Frame",
    body:
      "One image. One cinematic shot. Upload a still and get a complete video prompt with camera direction, motion cues, and negative prompts.",
  },
  {
    icon: ArrowLeftRight,
    title: "Start + End",
    body:
      "Two frames. A seamless transition. Define your opening and closing shots — MovPrompt writes the motion between them.",
  },
  {
    icon: LayoutGrid,
    title: "Multi-Shot",
    body:
      "One image. A full storyboard. Generate an entire sequence of shots from a single frame — ready for batch generation.",
  },
];

const TESTIMONIALS = [
  {
    quote: "MovPrompt cut my prep time in half. I drop a still and ship a Kling shot in minutes.",
    name: "Lina Ortega",
    handle: "@linafilms",
  },
  {
    quote: "It actually understands cinematography. The negative prompt alone is worth it.",
    name: "Daichi Mori",
    handle: "@dmori.cinema",
  },
  {
    quote: "Storyboards in one click. My whole team uses it now for AI ad concepts.",
    name: "Aria Patel",
    handle: "@ariadirects",
  },
];

/* ---------------- Wordmark ---------------- */

function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display font-bold tracking-tight text-foreground select-none",
        className,
      )}
    >
      <span className="text-accent">Mov</span>Prompt
    </span>
  );
}

/* ---------------- Count-up hook ---------------- */

function useCountUp(target: number, durationMs = 2000, start = false) {
  const [value, setValue] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!start) return;
    if (reduce) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, start, reduce]);
  return value;
}

/* ---------------- Section primitives ---------------- */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
      {children}
    </span>
  );
}

function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ============================================================
   Navbar
   ============================================================ */

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-card/80 border-b border-border"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="#top" className="flex items-center">
          <Wordmark className="text-xl" />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link
            to="/auth"
            className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-[14px] font-semibold text-accent-foreground shadow-[0_0_0_rgba(240,168,42,0)] transition-all hover:shadow-[0_0_24px_hsl(var(--accent)/0.35)]"
          >
            Try It Free
          </Link>
        </div>

        <button
          aria-label="Toggle menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile panel */}
      <motion.div
        initial={false}
        animate={open ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden border-t border-border bg-card/95 backdrop-blur-xl md:hidden"
      >
        <div className="flex flex-col gap-4 px-6 py-6">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-[15px] font-medium text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/auth"
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-[14px] font-semibold text-accent-foreground"
          >
            Try It Free
          </Link>
        </div>
      </motion.div>
    </header>
  );
}

/* ============================================================
   Hero with mouse parallax + layered depth
   ============================================================ */

function Hero({ scrollY }: { scrollY: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Mouse-driven motion values
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 80, damping: 18, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 80, damping: 18, mass: 0.4 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      mx.set((e.clientX / w - 0.5) * 2); // -1..1
      my.set((e.clientY / h - 0.5) * 2);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my, reduce]);

  // Scroll parallax for each depth layer
  const layer1Y = useTransform(scrollY, [0, 800], [0, -240]);
  const layer2Y = useTransform(scrollY, [0, 800], [0, -160]);

  // Mouse parallax (in px) — different ranges per layer
  const orbX = useTransform(sx, [-1, 1], [-12, 12]);
  const gridX = useTransform(sx, [-1, 1], [-6, 6]);
  const gridY = useTransform(sy, [-1, 1], [-6, 6]);

  return (
    <section
      id="top"
      ref={ref}
      className="relative flex min-h-screen items-center justify-center overflow-hidden pt-24"
    >
      {/* Layer 0: ambient background video */}
      {!reduce && (
        <video
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          src="/hero-bg.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        />
      )}
      {/* Dimming gradient over the video for legibility without muddying it */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-background/20 to-background/70"
        aria-hidden
      />





      {/* Layer 3: perspective grid */}
      <motion.div
        style={{ y: reduce ? 0 : layer2Y, x: reduce ? 0 : gridX, translateY: reduce ? 0 : gridY }}
        className="pointer-events-none absolute inset-0 [perspective:800px]"
        aria-hidden
      >
        <div
          className="absolute inset-x-[-20%] bottom-[-10%] h-[80%] opacity-[0.05] [transform:rotateX(60deg)]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </motion.div>

      {/* Layer 4: atmospheric haze + dust grain */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 100% 60% at 50% 110%, hsl(var(--background)) 0%, transparent 70%)",
        }}
      />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04] mix-blend-overlay"
        aria-hidden
      >
        <filter id="hero-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-grain)" />
      </svg>

      {/* Layer 5: vignette darkening bottom-left for headline contrast */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 15% 95%, hsl(var(--background) / 0.85), transparent 60%)",
        }}
      />


      {/* Layer 4: content */}
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
        <FadeUp>
          <SectionEyebrow>AI Director</SectionEyebrow>
        </FadeUp>
        <FadeUp delay={0.1}>
          <h1 className="mt-6 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-[56px]">
            Turn Stills Into Cinema
          </h1>
        </FadeUp>
        <FadeUp delay={0.2}>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground md:text-[17px]">
            Drop a frame. Pick a model. Get a director-grade video prompt ready to paste into
            Kling, Veo, Seedance, or any AI video tool.
          </p>
        </FadeUp>
        <FadeUp delay={0.3}>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <Link
              to="/auth"
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-8 text-[15px] font-semibold text-accent-foreground transition-all hover:shadow-[0_0_28px_hsl(var(--accent)/0.4)]"
            >
              Get Started
            </Link>
            <a
              href="#features"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-transparent px-8 text-[15px] font-semibold text-foreground transition-all hover:bg-card"
            >
              See Examples
            </a>
          </div>
        </FadeUp>
        <FadeUp delay={0.4}>
          <p className="mt-5 text-[13px] text-muted-foreground">No credit card required</p>
        </FadeUp>
      </div>
    </section>
  );
}

/* ============================================================
   Stats Bar
   ============================================================ */

function StatItem({
  value,
  suffix,
  label,
  inView,
}: {
  value: number;
  suffix?: string;
  label: string;
  inView: boolean;
}) {
  const n = useCountUp(value, 2000, inView);
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-4 text-center">
      <div
        className="font-display text-[36px] font-bold tracking-tight text-foreground md:text-[40px]"
        style={{ textShadow: "0 0 40px hsl(var(--accent) / 0.15)" }}
      >
        {n.toLocaleString()}
        {suffix}
      </div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  return (
    <section className="relative px-6 py-16 md:py-24">
      <FadeUp className="mx-auto max-w-4xl">
        <div
          ref={ref}
          className="rounded-2xl border border-border bg-card p-2 md:p-4"
        >
          <div className="flex flex-col divide-y divide-border md:flex-row md:divide-x md:divide-y-0">
            <StatItem value={2400} suffix="+" label="Creators" inView={inView} />
            <StatItem value={47000} suffix="+" label="Prompts Generated" inView={inView} />
            <StatItem value={8} label="AI Video Models" inView={inView} />
          </div>
        </div>
      </FadeUp>
    </section>
  );
}

/* ============================================================
   Features ("How It Works")
   ============================================================ */

function Features() {
  return (
    <section id="features" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <FadeUp className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>How It Works</SectionEyebrow>
          <h2 id="how" className="mt-5 scroll-mt-24 font-display text-[32px] font-bold leading-tight tracking-[-0.02em] text-foreground md:text-[40px]">
            From Frame to Film in Seconds
          </h2>
          <p className="mt-4 text-[16px] text-muted-foreground">
            Drop a still. Chat with the Director. Ship a cinematic prompt — and the video that follows.
          </p>
        </FadeUp>

        <div className="mt-14">
          <HowItWorksWalkthrough />
        </div>

        <div className="mt-24">
          <FadeUp className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Workflows</SectionEyebrow>
            <h3 className="mt-5 font-display text-[24px] font-bold tracking-[-0.02em] text-foreground md:text-[28px]">
              Four ways in
            </h3>
          </FadeUp>
          <div className="mt-10">
            <FeatureDeck />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- How It Works · Animated Walkthrough ---------------- */

const WALKTHROUGH_STEPS = [
  {
    icon: Upload,
    label: "Drop a frame",
    hint: "Any still — your storyboard sketch, a screen-grab, a generated image.",
  },
  {
    icon: Sparkles,
    label: "Chat with the Director",
    hint: "It reads the shot. Asks the right questions. Camera, light, motion.",
  },
  {
    icon: FileText,
    label: "Get the prompt",
    hint: "A model-ready prompt with motion cues, lensing and negative prompt.",
  },
  {
    icon: Film,
    label: "Generate the shot",
    hint: "Send it to Kling, Veo, Seedance — or batch a full storyboard.",
  },
];

function HowItWorksWalkthrough() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % WALKTHROUGH_STEPS.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [inView, reduce]);

  return (
    <div ref={ref} className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1.2fr_1fr] md:items-stretch">
      {/* Stage */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-sm">
        {/* Ambient glow */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-24"
          animate={
            reduce
              ? undefined
              : { background: [
                  "radial-gradient(40% 40% at 30% 30%, hsl(var(--accent) / 0.18), transparent 70%)",
                  "radial-gradient(40% 40% at 70% 60%, hsl(var(--primary) / 0.18), transparent 70%)",
                  "radial-gradient(40% 40% at 30% 30%, hsl(var(--accent) / 0.18), transparent 70%)",
                ] }
          }
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        />

        <div className="relative">
          {/* Window chrome */}
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
            <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              movprompt · session
            </span>
          </div>

          <div className="relative h-[320px] sm:h-[340px]">
            <WalkUpload active={step === 0} reduce={!!reduce} />
            <WalkChat active={step === 1} reduce={!!reduce} />
            <WalkPrompt active={step === 2} reduce={!!reduce} />
            <WalkVideo active={step === 3} reduce={!!reduce} />
          </div>
        </div>
      </div>

      {/* Steps rail */}
      <ol className="flex flex-col justify-center gap-3">
        {WALKTHROUGH_STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "group flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all duration-300",
                  active
                    ? "border-accent/50 bg-accent/5 shadow-[0_0_0_1px_hsl(var(--accent)/0.25)]"
                    : "border-border bg-card/40 hover:border-accent/30",
                )}
              >
                <span
                  className={cn(
                    "relative grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition-colors",
                    active
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : done
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold",
                      active
                        ? "bg-accent text-accent-foreground"
                        : done
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div
                    className={cn(
                      "font-display text-[15px] font-semibold",
                      active ? "text-foreground" : "text-foreground/80",
                    )}
                  >
                    {s.label}
                  </div>
                  <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {s.hint}
                  </div>
                  {/* Progress line */}
                  <div className="mt-3 h-px w-full overflow-hidden bg-border/70">
                    <motion.div
                      className="h-full bg-accent"
                      initial={false}
                      animate={{ width: active ? "100%" : done ? "100%" : "0%" }}
                      transition={{ duration: active && !reduce ? 3.2 : 0.3, ease: "linear" }}
                    />
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StageLayer({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      aria-hidden={!active}
      initial={false}
      animate={{
        opacity: active ? 1 : 0,
        scale: active ? 1 : 0.98,
        y: active ? 0 : 8,
      }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
      style={{ pointerEvents: active ? "auto" : "none" }}
    >
      {children}
    </motion.div>
  );
}

function WalkUpload({ active, reduce }: { active: boolean; reduce: boolean }) {
  return (
    <StageLayer active={active}>
      <div className="flex h-full items-center justify-center">
        <div className="relative grid h-full w-full place-items-center rounded-xl border border-dashed border-border bg-background/40">
          {/* Sweeping scan line */}
          <motion.div
            aria-hidden
            className="absolute inset-x-4 top-4 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
            initial={{ y: 0, opacity: 0 }}
            animate={active && !reduce ? { y: [0, 240, 0], opacity: [0, 1, 0] } : { opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Frame placeholder filling in */}
          <motion.div
            className="relative h-[200px] w-[78%] overflow-hidden rounded-lg border border-border bg-gradient-to-br from-muted/40 to-background"
            initial={{ opacity: 0, y: 12 }}
            animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.6, delay: active ? 0.1 : 0 }}
          >
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--accent) / 0.18) 60%, transparent)",
              }}
              animate={active && !reduce ? { backgroundPosition: ["0% 0%", "100% 100%"] } : undefined}
              transition={{ duration: 6, repeat: Infinity, repeatType: "mirror" }}
            />
            {/* Faux subject silhouette */}
            <div className="absolute bottom-6 left-1/2 h-16 w-24 -translate-x-1/2 rounded-t-full bg-foreground/20 blur-[2px]" />
            <div className="absolute right-4 top-3 rounded-full bg-background/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              frame.jpg
            </div>
          </motion.div>
          <div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
            <Upload className="h-3.5 w-3.5 text-accent" />
            Drop any still — JPG, PNG, WebP
          </div>
        </div>
      </div>
    </StageLayer>
  );
}

function WalkChat({ active, reduce }: { active: boolean; reduce: boolean }) {
  const directorLine = "Got it. Slow dolly-in, golden hour key from camera-left, anamorphic flare. Confirm?";
  const userLine = "Make it cinematic, 24fps, gentle push-in.";
  return (
    <StageLayer active={active}>
      <div className="flex h-full flex-col justify-end gap-3 p-1">
        <motion.div
          className="self-end max-w-[78%] rounded-2xl rounded-tr-sm border border-border bg-background/70 px-4 py-2.5 text-[13px] text-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.4, delay: active ? 0.1 : 0 }}
        >
          {userLine}
        </motion.div>

        <motion.div
          className="self-start max-w-[86%] rounded-2xl rounded-tl-sm border border-accent/30 bg-accent/5 px-4 py-3"
          initial={{ opacity: 0, y: 10 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.4, delay: active ? 0.6 : 0 }}
        >
          <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            <Sparkles className="h-3 w-3" />
            Director
          </div>
          <TypeLine text={directorLine} active={active} reduce={reduce} delay={0.8} />
        </motion.div>

        <motion.div
          className="self-start flex items-center gap-1 px-2"
          initial={{ opacity: 0 }}
          animate={active && !reduce ? { opacity: [0, 1, 1, 0] } : { opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, delay: 1.6 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-accent/70"
              animate={reduce ? undefined : { y: [0, -3, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }}
            />
          ))}
        </motion.div>
      </div>
    </StageLayer>
  );
}

function TypeLine({
  text,
  active,
  reduce,
  delay = 0,
}: {
  text: string;
  active: boolean;
  reduce: boolean;
  delay?: number;
}) {
  const [shown, setShown] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (!active) {
      setShown(reduce ? text.length : 0);
      return;
    }
    if (reduce) {
      setShown(text.length);
      return;
    }
    let i = 0;
    const start = window.setTimeout(() => {
      const id = window.setInterval(() => {
        i += 1;
        setShown(i);
        if (i >= text.length) window.clearInterval(id);
      }, 22);
      // store for cleanup
      (start as unknown as { _id?: number })._id = id;
    }, delay * 1000);
    return () => {
      window.clearTimeout(start);
      const inner = (start as unknown as { _id?: number })._id;
      if (inner) window.clearInterval(inner);
    };
  }, [active, reduce, text, delay]);
  return (
    <p className="text-[13px] leading-relaxed text-foreground">
      {text.slice(0, shown)}
      <span className="ml-0.5 inline-block h-3.5 w-[2px] -mb-0.5 bg-accent align-middle" />
    </p>
  );
}

function WalkPrompt({ active, reduce }: { active: boolean; reduce: boolean }) {
  const lines = [
    { k: "shot", v: "MCU, anamorphic 2.39:1" },
    { k: "camera", v: "slow dolly-in, 35mm, T2.0" },
    { k: "light", v: "golden hour key, camera-left" },
    { k: "motion", v: "subject still, leaves drift L→R" },
    { k: "negative", v: "warp, extra fingers, banding" },
  ];
  return (
    <StageLayer active={active}>
      <div className="h-full overflow-hidden rounded-xl border border-border bg-background/70 p-4 font-mono text-[12px] leading-relaxed">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <FileText className="h-3 w-3" />
          prompt.json
        </div>
        <div className="space-y-1.5">
          {lines.map((l, i) => (
            <motion.div
              key={l.k}
              className="flex gap-3"
              initial={{ opacity: 0, x: -8 }}
              animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
              transition={{ duration: 0.35, delay: active ? 0.15 + i * 0.18 : 0 }}
            >
              <span className="w-[68px] shrink-0 text-accent">{l.k}</span>
              <span className="text-foreground/90">{l.v}</span>
            </motion.div>
          ))}
        </div>
        <motion.div
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-primary"
          initial={{ opacity: 0, y: 6 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{ duration: 0.4, delay: active ? 1.2 : 0 }}
        >
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-primary"
            animate={active && !reduce ? { opacity: [0.4, 1, 0.4] } : undefined}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          copied to clipboard
        </motion.div>
      </div>
    </StageLayer>
  );
}

function WalkVideo({ active, reduce }: { active: boolean; reduce: boolean }) {
  return (
    <StageLayer active={active}>
      <div className="relative h-full overflow-hidden rounded-xl border border-border bg-background">
        {/* Animated cinematic gradient */}
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(120deg, hsl(var(--primary) / 0.35), hsl(var(--accent) / 0.25) 55%, hsl(220 40% 8%))",
            backgroundSize: "200% 200%",
          }}
          animate={active && !reduce ? { backgroundPosition: ["0% 0%", "100% 100%"] } : undefined}
          transition={{ duration: 6, repeat: Infinity, repeatType: "mirror", ease: "linear" }}
        />
        {/* Letterbox */}
        <div className="absolute inset-x-0 top-0 h-8 bg-background" />
        <div className="absolute inset-x-0 bottom-0 h-8 bg-background" />
        {/* Light flare */}
        <motion.div
          aria-hidden
          className="absolute -inset-y-10 w-32 rotate-12 bg-gradient-to-r from-transparent via-white/15 to-transparent blur-md"
          initial={{ x: "-30%" }}
          animate={active && !reduce ? { x: ["-30%", "130%"] } : undefined}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* HUD */}
        <div className="absolute left-3 top-10 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/80">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-destructive"
            animate={active && !reduce ? { opacity: [0.3, 1, 0.3] } : undefined}
            transition={{ duration: 1, repeat: Infinity }}
          />
          REC · Kling 1.6
        </div>
        <div className="absolute right-3 top-10 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/80">
          24fps · 2.39
        </div>
        {/* Timecode */}
        <div className="absolute bottom-10 left-3 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/80">
          00:00:04:12
        </div>
        {/* Play badge */}
        <motion.div
          className="absolute inset-0 grid place-items-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={active ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.5, delay: active ? 0.2 : 0 }}
        >
          <div className="grid h-14 w-14 place-items-center rounded-full border border-foreground/30 bg-background/60 backdrop-blur">
            <Film className="h-5 w-5 text-accent" />
          </div>
        </motion.div>
      </div>
    </StageLayer>
  );
}

/* ---------------- Feature Deck ---------------- */

function FeatureDeck() {
  const reduce = useReducedMotion();
  const [order, setOrder] = useState<number[]>(() => FEATURES.map((_, i) => i));
  const [exitDir, setExitDir] = useState<1 | -1 | 0>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const advance = (dir: 1 | -1) => {
    setExitDir(dir);
    // small delay so exit animation can play
    window.setTimeout(
      () => {
        setOrder((o) => {
          if (dir === 1) return [...o.slice(1), o[0]];
          return [o[o.length - 1], ...o.slice(0, -1)];
        });
        setExitDir(0);
      },
      reduce ? 0 : 280,
    );
  };

  // Keyboard nav when deck container is focused
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") advance(1);
    if (e.key === "ArrowLeft") advance(-1);
  };

  const topIndex = order[0];

  return (
    <div className="flex flex-col items-center">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKey}
        className="relative h-[360px] w-full max-w-md outline-none [perspective:1200px] sm:h-[340px]"
        aria-label="Features deck. Use arrow keys or drag to navigate."
      >
        {order.map((featureIdx, slot) => {
          const isTop = slot === 0;
          const depth = Math.min(slot, 3);
          // Hide the 4th card visually but keep mounted for smooth rotation
          const hidden = slot >= 3;
          return (
            <DeckCard
              key={featureIdx}
              feature={FEATURES[featureIdx]}
              depth={depth}
              isTop={isTop}
              hidden={hidden}
              exitDir={isTop ? exitDir : 0}
              reduce={!!reduce}
              onSwipe={advance}
            />
          );
        })}
      </div>

      {/* Controls */}
      <div className="mt-8 flex items-center gap-5">
        <button
          type="button"
          onClick={() => advance(-1)}
          aria-label="Previous feature"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-accent/40 hover:text-accent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2" role="tablist">
          {FEATURES.map((f, i) => {
            const active = i === topIndex;
            return (
              <button
                key={f.title}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={f.title}
                onClick={() => {
                  if (i === topIndex) return;
                  // rotate order so chosen index becomes first
                  setOrder((o) => {
                    const pos = o.indexOf(i);
                    return [...o.slice(pos), ...o.slice(0, pos)];
                  });
                }}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  active ? "w-8 bg-accent" : "w-1.5 bg-border hover:bg-muted-foreground/60",
                )}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => advance(1)}
          aria-label="Next feature"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-accent/40 hover:text-accent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Deck Card ---------------- */

function DeckCard({
  feature,
  depth,
  isTop,
  hidden,
  exitDir,
  reduce,
  onSwipe,
}: {
  feature: (typeof FEATURES)[number];
  depth: number;
  isTop: boolean;
  hidden: boolean;
  exitDir: 1 | -1 | 0;
  reduce: boolean;
  onSwipe: (dir: 1 | -1) => void;
}) {
  const Icon = feature.icon;
  const isFlagship = "flagship" in feature && (feature as { flagship?: boolean }).flagship;

  // Tilt motion values
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springX = useSpring(tiltX, { stiffness: 220, damping: 18, mass: 0.4 });
  const springY = useSpring(tiltY, { stiffness: 220, damping: 18, mass: 0.4 });

  const draggingRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.PointerEvent) => {
    if (!isTop || reduce || draggingRef.current) return;
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    tiltY.set(px * 12); // rotateY
    tiltX.set(-py * 10); // rotateX
  };

  const resetTilt = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  // Animated state per depth (resting position in the stack)
  const restingY = depth * 14;
  const restingScale = 1 - depth * 0.05;
  const restingOpacity = depth >= 3 ? 0 : 1 - depth * 0.18;

  const animateTo =
    isTop && exitDir !== 0
      ? {
          x: exitDir * 480,
          opacity: 0,
          rotateZ: exitDir * 14,
          transition: { duration: 0.28, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
        }
      : {
          x: 0,
          y: restingY,
          scale: restingScale,
          opacity: restingOpacity,
          rotateZ: 0,
        };

  return (
    <motion.div
      ref={cardRef}
      className={cn(
        "absolute inset-0 select-none rounded-2xl border bg-card p-8 will-change-transform",
        isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
        isFlagship
          ? "border-accent/30 shadow-[0_8px_56px_hsl(var(--accent)/0.18)]"
          : "border-border shadow-[0_4px_32px_hsl(var(--background)/0.4)]",
        hidden && "opacity-0",
      )}
      style={
        isTop
          ? {
              zIndex: 30 - depth,
              rotateX: springX,
              rotateY: springY,
              transformStyle: "preserve-3d",
            }
          : { zIndex: 30 - depth }
      }
      initial={false}
      animate={animateTo}
      transition={
        isTop && exitDir !== 0
          ? undefined
          : { type: "spring", stiffness: 260, damping: 28 }
      }
      drag={isTop && !reduce ? "x" : false}
      dragElastic={0.6}
      dragConstraints={{ left: 0, right: 0 }}
      onDragStart={() => {
        draggingRef.current = true;
        resetTilt();
      }}
      onDragEnd={(_, info) => {
        draggingRef.current = false;
        const threshold = 120;
        if (info.offset.x > threshold || info.velocity.x > 600) onSwipe(1);
        else if (info.offset.x < -threshold || info.velocity.x < -600) onSwipe(-1);
      }}
      onPointerMove={handleMove}
      onPointerLeave={resetTilt}
      aria-hidden={!isTop}
    >
      <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent/10 to-accent/5">
        <Icon className="h-6 w-6 text-accent" strokeWidth={2} />
      </div>
      <h3 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
        {feature.title}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{feature.body}</p>

      {isTop && (
        <span className="pointer-events-none absolute bottom-5 right-6 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
          Drag · ← →
        </span>
      )}
    </motion.div>
  );
}

/* ============================================================
   Scene Control (split layout with 3D mock)
   ============================================================ */

function SceneControl({ scrollY }: { scrollY: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const tilt = useTransform(scrollYProgress, [0, 1], [-3, 6]);
  const leftY = useTransform(scrollY, [600, 1800], [40, -40]);
  const rightY = useTransform(scrollY, [600, 1800], [0, -80]);

  const chips = ["Subject", "Background", "Lighting", "Atmosphere"];
  const rows = [
    { label: "Subject", locked: true, fill: 0.7 },
    { label: "Background", locked: false, fill: 0.45 },
    { label: "Lighting", locked: true, fill: 0.85 },
    { label: "Atmosphere", locked: false, fill: 0.3 },
  ];

  return (
    <section ref={ref} className="relative px-6 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16">
        {/* Left */}
        <motion.div style={{ y: reduce ? 0 : leftY }}>
          <SectionEyebrow>Full Control</SectionEyebrow>
          <h2 className="mt-5 font-display text-[32px] font-bold leading-tight tracking-[-0.02em] text-foreground md:text-[40px]">
            Direct Every Element
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">
            MovPrompt breaks your scene into subject, background, lighting, and atmosphere. Lock
            what stays. Move what animates. Full directorial control.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {c}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Right — interactive 3D mock card */}
        <SceneBreakdownCard rows={rows} reduce={reduce} rightY={rightY} />
      </div>
    </section>
  );
}

function SceneBreakdownCard({
  rows,
  reduce,
  rightY,
}: {
  rows: { label: string; locked: boolean; fill: number }[];
  reduce: boolean;
  rightY: any;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(cardRef, { once: true, margin: "-20%" });

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 140, damping: 14, mass: 0.5 });
  const sry = useSpring(ry, { stiffness: 140, damping: 14, mass: 0.5 });

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 18);
    rx.set(-py * 14);
  };
  const handleLeave = () => {
    rx.set(reduce ? 0 : -2);
    ry.set(reduce ? 0 : -4);
  };
  useEffect(() => {
    handleLeave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  return (
    <motion.div
      style={{ y: reduce ? 0 : rightY }}
      className="relative [perspective:1400px]"
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {/* glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-8 rounded-[2rem] blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 50%, hsl(var(--accent) / 0.18), transparent 70%)",
        }}
        animate={reduce ? undefined : { opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        ref={cardRef}
        className="relative rounded-2xl border border-border bg-card p-6 shadow-[0_20px_60px_-20px_hsl(var(--accent)/0.25)] [transform-style:preserve-3d]"
        style={{ rotateX: srx, rotateY: sry }}
      >
        {/* floating sheen */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
          style={{
            background:
              "linear-gradient(120deg, transparent 30%, hsl(var(--accent) / 0.12) 50%, transparent 70%)",
            transform: "translateZ(1px)",
          }}
          animate={reduce ? undefined : { backgroundPositionX: ["0%", "200%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />

        <div
          className="mb-5 flex items-center justify-between"
          style={{ transform: "translateZ(40px)" }}
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Scene Breakdown
          </span>
          <span className="text-[11px] text-muted-foreground">v1</span>
        </div>
        <div className="space-y-4" style={{ transform: "translateZ(30px)" }}>
          {rows.map((r, i) => {
            const LockIcon = r.locked ? Lock : Unlock;
            return (
              <motion.div
                key={r.label}
                className="flex items-center gap-3"
                initial={reduce ? false : { opacity: 0, x: -16 }}
                animate={inView ? { opacity: 1, x: 0 } : undefined}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.1, ease: "easeOut" }}
                style={{ transform: `translateZ(${20 + i * 8}px)` }}
              >
                <span className="w-24 text-[13px] font-medium text-foreground">{r.label}</span>
                <motion.span
                  animate={
                    reduce
                      ? undefined
                      : r.locked
                        ? { rotate: [0, -8, 0] }
                        : { y: [0, -2, 0] }
                  }
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.2,
                  }}
                >
                  <LockIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                </motion.span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-border">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={inView ? { width: `${r.fill * 100}%` } : { width: 0 }}
                    transition={{ duration: 1.1, delay: 0.3 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <motion.div
                    aria-hidden
                    className="absolute inset-y-0 w-12 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    initial={{ x: "-100%" }}
                    animate={inView && !reduce ? { x: ["-100%", "400%"] } : undefined}
                    transition={{
                      duration: 2.4,
                      repeat: Infinity,
                      delay: 1 + i * 0.2,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============================================================
   Models
   ============================================================ */

function Models() {
  return (
    <section className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-4xl text-center">
        <FadeUp>
          <SectionEyebrow>Compatibility</SectionEyebrow>
          <h2 className="mt-5 font-display text-[32px] font-bold leading-tight tracking-[-0.02em] text-foreground md:text-[40px]">
            Works With Every Major AI Video Model
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[16px] text-muted-foreground">
            Every prompt comes with a recommended model, a negative prompt, and camera direction.
            One click to copy. Ready to paste.
          </p>
        </FadeUp>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {MODELS.map((m, i) => (
            <motion.span
              key={m}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground transition-all hover:border-accent/20 hover:shadow-[0_0_18px_hsl(var(--accent)/0.12)]"
            >
              {m}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Testimonials
   ============================================================ */

function Testimonials() {
  return (
    <section id="testimonials" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <FadeUp className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Creators</SectionEyebrow>
          <h2 className="mt-5 font-display text-[32px] font-bold leading-tight tracking-[-0.02em] text-foreground md:text-[40px]">
            Trusted by Filmmakers and AI Creators
          </h2>
        </FadeUp>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => {
            // middle card slightly ahead
            const delay = i === 1 ? 0 : 0.15;
            const offset = i === 1 ? 40 : 70;
            return (
              <motion.figure
                key={t.name}
                initial={{ opacity: 0, y: offset }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
                className="relative rounded-2xl border border-border bg-card p-8"
              >
                <div
                  aria-hidden
                  className="absolute left-6 top-3 font-display text-[64px] leading-none text-accent/30"
                >
                  “
                </div>
                <blockquote className="relative mt-6 text-[16px] italic leading-relaxed text-foreground">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-6">
                  <div className="text-[13px] font-semibold text-foreground">{t.name}</div>
                  <div className="text-[13px] text-muted-foreground">{t.handle}</div>
                </figcaption>
              </motion.figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Final CTA
   ============================================================ */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden px-6 py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--accent) / 0.08) 0%, hsl(var(--background)) 70%)",
        }}
      />
      <FadeUp className="relative mx-auto max-w-3xl text-center">
        <h2 className="font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-[56px]">
          Stop Writing Prompts. Start Directing.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[16px] text-muted-foreground">
          Join 2,400+ creators using MovPrompt to generate cinematic AI video prompts.
        </p>
        <div className="mt-9 flex flex-col items-center gap-3">
          <Link
            to="/auth"
            className="relative inline-flex h-14 items-center justify-center rounded-full bg-accent px-10 text-[16px] font-semibold text-accent-foreground"
            style={{ animation: "cta-pulse 3s ease-in-out infinite" }}
          >
            Get Started Free
          </Link>
          <p className="text-[13px] text-muted-foreground">No credit card required</p>
        </div>
      </FadeUp>

      <style>{`
        @keyframes cta-pulse {
          0%, 100% { box-shadow: 0 0 24px hsl(var(--accent) / 0.15); }
          50% { box-shadow: 0 0 48px hsl(var(--accent) / 0.4); }
        }
      `}</style>
    </section>
  );
}

/* ============================================================
   Footer
   ============================================================ */

function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <Wordmark className="text-lg" />
        <nav className="flex flex-wrap items-center justify-center gap-6">
          {["Privacy", "Terms", "About", "Examples"].map((l) => (
            <a
              key={l}
              href="#"
              className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l}
            </a>
          ))}
        </nav>
        <a
          href="mailto:hello@movprompt.com"
          className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          hello@movprompt.com
        </a>
      </div>
      <div className="mx-auto mt-8 max-w-6xl border-t border-border pt-6 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">
          © 2026 MovPrompt. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/* ============================================================
   Page
   ============================================================ */

export default function Landing() {
  const { scrollY } = useScroll();

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Seo
        title="MovPrompt — AI Director for Generative Video"
        description="Drop a frame. Pick a model. Get director-grade AI video prompts for Kling, Veo, Seedance and more."
      />

      {/* Grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <Navbar />

      <main className="relative z-10">
        <Hero scrollY={scrollY} />
        <Features />
        <SceneControl scrollY={scrollY} />
        <Models />
        
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}
