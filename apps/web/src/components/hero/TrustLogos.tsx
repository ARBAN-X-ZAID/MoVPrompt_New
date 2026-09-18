const LOGOS = ["Coca-Cola", "Ogilvy", "R/GA", "Wonder", "GUESS", "Delivery Hero", "Nubank"];

export const TrustLogos = () => {
  return (
    <div className="absolute bottom-0 inset-x-0 z-20 pb-8 px-6 md:px-10">
      <p className="text-center text-xs text-white/60 mb-4 tracking-wide">
        Trusted by creators, studios & brands
      </p>
      <div className="flex items-center justify-center gap-8 md:gap-12 flex-wrap opacity-70">
        {LOGOS.map((l) => (
          <span
            key={l}
            className="text-white/80 text-sm md:text-base font-semibold tracking-wide grayscale"
            style={{ fontFamily: "Georgia, serif", fontStyle: l === "Ogilvy" ? "italic" : "normal" }}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
};
