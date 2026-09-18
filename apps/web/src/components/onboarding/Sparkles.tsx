import { motion } from "framer-motion";

/** Lightweight 1-second sparkle burst overlay. */
export const Sparkles = () => {
  const dots = Array.from({ length: 14 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        const dist = 80 + Math.random() * 80;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-primary"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
            animate={{ x, y, opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.02 }}
            style={{ boxShadow: "0 0 12px hsl(var(--primary))" }}
          />
        );
      })}
    </div>
  );
};
