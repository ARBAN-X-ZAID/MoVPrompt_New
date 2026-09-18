import { useEffect } from "react";
import { CinematicHero } from "@/components/hero/CinematicHero";

const HeroPreview = () => {
  useEffect(() => {
    // Load Fraunces display font
    const id = "fraunces-font";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  return (
    <main className="min-h-screen bg-black">
      <CinematicHero />
    </main>
  );
};

export default HeroPreview;
