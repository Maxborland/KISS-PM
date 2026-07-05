import { useCallback, useEffect, useRef, useState } from "react";
import { OrbitScene } from "./OrbitScene";
import { ORBIT_CONFIGS } from "./orbitData";
import { SCALE_STATES } from "./scaleStates";
import type { ScaleId } from "./types";

const GROWTH_STEP_MS = 1000;
const INITIAL_VISIBLE_RINGS = 6;
const MOBILE_QUERY = "(max-width: 767px)";

export default function PortfolioChaosControl() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeId, setActiveId] = useState<ScaleId>("team");
  const [visibleRingCount, setVisibleRingCount] = useState(INITIAL_VISIBLE_RINGS);
  const [mobile, setMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const growthRanRef = useRef(false);

  const markUserInteraction = useCallback(() => {
    setUserInteracted(true);
  }, []);

  useEffect(() => {
    const mobileMq = window.matchMedia(MOBILE_QUERY);
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncMobile = () => setMobile(mobileMq.matches);
    const syncMotion = () => setReducedMotion(motionMq.matches);

    syncMobile();
    syncMotion();
    mobileMq.addEventListener("change", syncMobile);
    motionMq.addEventListener("change", syncMotion);

    return () => {
      mobileMq.removeEventListener("change", syncMobile);
      motionMq.removeEventListener("change", syncMotion);
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }

    const timeoutIds: number[] = [];

    const startGrowth = () => {
      if (growthRanRef.current) {
        return;
      }

      growthRanRef.current = true;
      setActiveId("holding");
      setVisibleRingCount(
        reducedMotion ? ORBIT_CONFIGS.holding.rings.length : INITIAL_VISIBLE_RINGS,
      );

      if (!reducedMotion) {
        ORBIT_CONFIGS.holding.rings.slice(INITIAL_VISIBLE_RINGS).forEach((_, index) => {
          timeoutIds.push(
            window.setTimeout(
              () => setVisibleRingCount(INITIAL_VISIBLE_RINGS + index + 1),
              (index + 1) * GROWTH_STEP_MS,
            ),
          );
        });
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        startGrowth();
      },
      { threshold: 0.35 },
    );

    observer.observe(section);
    const sectionRect = section.getBoundingClientRect();
    const visibleHeight =
      Math.min(sectionRect.bottom, window.innerHeight) - Math.max(sectionRect.top, 0);
    if (visibleHeight / sectionRect.height >= 0.22 || window.location.hash === "#portfolio") {
      window.requestAnimationFrame(startGrowth);
    }

    return () => {
      observer.disconnect();
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [reducedMotion]);

  return (
    <section
      ref={sectionRef}
      id="portfolio"
      className="portfolioChaosSection l-band l-band--portfolio-chaos"
      aria-label="Орбита портфеля KISS PM"
    >
      <div className="l-band__grid portfolioChaosSection__grid" aria-hidden="true" />

      <div className="sectionInner">
        <header className="sectionHeader">
          <h2 id="portfolio-chaos-title">Рост портфеля больше не требует роста ручного контроля.</h2>
          <p>
            KISS PM удерживает проекты, ресурсы, сигналы и решения в одной системе — даже
            когда параллельных проектов становится в разы больше.
          </p>
        </header>

        <p className="sr-only" aria-live="polite">
          Активен масштаб: {SCALE_STATES.find((scale) => scale.id === activeId)?.title} ·{" "}
          {SCALE_STATES.find((scale) => scale.id === activeId)?.role}
        </p>

        <OrbitScene
          activeId={activeId}
          mobile={mobile}
          reducedMotion={reducedMotion}
          userInteracted={userInteracted}
          visibleRingCount={visibleRingCount}
          onUserInteract={markUserInteraction}
        />

      </div>
    </section>
  );
}
