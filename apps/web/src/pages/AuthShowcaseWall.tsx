import { useEffect, useRef, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";

type WallTile = { poster: string; video?: string };

const PREVIEWS = "/template-previews";
const COLUMNS: WallTile[][] = [
  [
    { poster: `${PREVIEWS}/generated/food-beverage-seedance-v1.jpg`, video: `${PREVIEWS}/generated/food-beverage-seedance-v1.mp4` },
    { poster: `${PREVIEWS}/dessert-launch.jpg` },
    { poster: `${PREVIEWS}/electronics.jpg` },
    { poster: `${PREVIEWS}/fashion.jpg` },
  ],
  [
    { poster: `${PREVIEWS}/restaurant-signature-dish.jpg` },
    { poster: `${PREVIEWS}/generated/luxury-product-reveal-seedance-v1.jpg`, video: `${PREVIEWS}/generated/luxury-product-reveal-seedance-v1.mp4` },
    { poster: `${PREVIEWS}/ugc-review.jpg` },
    { poster: `${PREVIEWS}/founder-story.jpg` },
  ],
  [
    { poster: `${PREVIEWS}/footwear-motion.jpg` },
    { poster: `${PREVIEWS}/back-to-school-offer.jpg` },
    { poster: `${PREVIEWS}/generated/whatsapp-sales-ad-seedance-v1.jpg`, video: `${PREVIEWS}/generated/whatsapp-sales-ad-seedance-v1.mp4` },
    { poster: `${PREVIEWS}/app-service.jpg` },
  ],
];
const COLUMN_SECONDS = [64, 76, 58];

function releaseVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function WallVideo({ tile }: { tile: Required<WallTile> }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    const play = () => { void Promise.resolve(video.play()).catch(() => undefined); };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) play();
      else video.pause();
    }, { threshold: 0.2 });
    observer.observe(video);
    return () => {
      observer.disconnect();
      releaseVideo(video);
    };
  }, []);

  return <video ref={ref} src={tile.video} poster={tile.poster} muted loop playsInline preload="metadata" tabIndex={-1} />;
}

export function AuthShowcaseWall() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div className="auth-wall" data-static={reduceMotion ? "true" : "false"} aria-hidden="true">
      <div className="auth-wall-stage">
        {COLUMNS.map((column, index) => (
          <div
            key={index}
            className="auth-wall-column"
            data-direction={index % 2 ? "down" : "up"}
            style={{ "--auth-wall-duration": `${COLUMN_SECONDS[index]}s` } as CSSProperties}
          >
            <div className="auth-wall-track">
              {(reduceMotion ? column : [...column, ...column]).map((tile, tileIndex) => (
                <figure key={tileIndex} className="auth-wall-tile">
                  {tile.video && !reduceMotion
                    ? <WallVideo tile={tile as Required<WallTile>} />
                    : <img src={tile.poster} alt="" loading="lazy" decoding="async" width={720} height={1280} />}
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
