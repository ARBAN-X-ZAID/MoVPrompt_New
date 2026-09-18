import { useRef } from "react";
import { motion } from "framer-motion";
import { Upload, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "./OnboardingContext";
import s1 from "@/assets/onboarding/starter-1.jpg";
import s2 from "@/assets/onboarding/starter-2.jpg";
import s3 from "@/assets/onboarding/starter-3.jpg";
import s4 from "@/assets/onboarding/starter-4.jpg";
import s5 from "@/assets/onboarding/starter-5.jpg";
import s6 from "@/assets/onboarding/starter-6.jpg";

const STARTERS = [
  { url: s1, label: "Tokyo neon alley" },
  { url: s2, label: "Desert dunes" },
  { url: s3, label: "Rembrandt portrait" },
  { url: s4, label: "Cinematic kitchen" },
  { url: s5, label: "Underwater diver" },
  { url: s6, label: "Cyberpunk rooftop" },
];

async function urlToFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

export const StepStarterImage = () => {
  const { imageUrl, setImage, next } = useOnboarding();
  const fileRef = useRef<HTMLInputElement>(null);

  const pickStarter = async (url: string, label: string) => {
    const file = await urlToFile(url, `${label.replace(/\s+/g, "-").toLowerCase()}.jpg`);
    setImage(url, file);
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    setImage(URL.createObjectURL(f), f);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-3xl mx-auto"
    >
      <h2 className="font-display font-bold text-2xl sm:text-3xl text-center mb-2">
        Start with one of these
      </h2>
      <p className="text-muted-foreground text-center mb-8">…or upload your own still.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {STARTERS.map((s) => {
          const selected = imageUrl === s.url;
          return (
            <button
              key={s.url}
              type="button"
              onClick={() => pickStarter(s.url, s.label)}
              className={`relative group overflow-hidden rounded-lg border-2 transition-all ${
                selected ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-primary/40"
              }`}
            >
              <img
                src={s.url}
                alt={s.label}
                loading="lazy"
                className="w-full aspect-[16/10] object-cover"
              />
              {selected && (
                <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                  <Check className="w-4 h-4" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 text-[11px] text-white text-start">
                {s.label}
              </div>
            </button>
          );
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
          <Upload className="w-4 h-4" /> Upload your own
        </Button>
        <Button
          onClick={next}
          disabled={!imageUrl}
          className="gap-2 bg-[#F5A524] hover:bg-[#F5A524]/90 text-[#0A0A0B] font-semibold"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};
