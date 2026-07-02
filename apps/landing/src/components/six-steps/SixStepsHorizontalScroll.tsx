import { useCallback, useEffect, useRef, useState } from "react";
import { StepCard } from "./StepCard";
import { StepProgress } from "./StepProgress";
import { SIX_STEPS } from "./steps";

const MOBILE_FALLBACK_QUERY = "(max-width: 767px)";

interface ScrollMetrics {
  sectionTop: number;
  maxTranslate: number;
  sectionHeight: number;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export default function SixStepsHorizontalScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<ScrollMetrics>({
    sectionTop: 0,
    maxTranslate: 0,
    sectionHeight: 0,
  });
  const activeIndexRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mobileFallback, setMobileFallback] = useState(false);

  const setActiveIndexIfChanged = useCallback((nextIndex: number) => {
    if (activeIndexRef.current === nextIndex) {
      return;
    }
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
  }, []);

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track || mobileFallback) {
      return;
    }

    const { sectionTop, maxTranslate } = metricsRef.current;
    if (maxTranslate <= 0) {
      track.style.transform = "translate3d(0, 0, 0)";
      setActiveIndexIfChanged(0);
      return;
    }

    const progress = clamp((window.scrollY - sectionTop) / maxTranslate);
    const translateX = -progress * maxTranslate;
    track.style.transform = `translate3d(${translateX}px, 0, 0)`;

    const nextIndex = Math.round(progress * (SIX_STEPS.length - 1));
    setActiveIndexIfChanged(nextIndex);
  }, [mobileFallback, setActiveIndexIfChanged]);

  const requestUpdate = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      update();
    });
  }, [update]);

  const recalc = useCallback(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const mask = maskRef.current;
    const track = trackRef.current;
    if (!section || !sticky || !mask || !track) {
      return;
    }

    if (mobileFallback) {
      section.style.height = "";
      track.style.transform = "translate3d(0, 0, 0)";
      return;
    }

    const viewportWidth = mask.clientWidth;
    const trackWidth = track.scrollWidth;
    const maxTranslate = Math.max(0, trackWidth - viewportWidth);
    const sectionTop = section.getBoundingClientRect().top + window.scrollY;
    const sectionHeight = window.innerHeight + maxTranslate;

    section.style.height = `${sectionHeight}px`;
    metricsRef.current = {
      sectionTop,
      maxTranslate,
      sectionHeight,
    };

    update();
  }, [mobileFallback, update]);

  const scrollToIndex = useCallback((index: number) => {
    const { sectionTop, maxTranslate } = metricsRef.current;
    if (mobileFallback) {
      const track = trackRef.current;
      const slide = track?.querySelectorAll<HTMLElement>("[data-six-slide]")[index];
      if (track && slide) {
        const targetLeft = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
        track.scrollTo({ left: targetLeft, behavior: "smooth" });
      }
      return;
    }

    const targetY =
      sectionTop + maxTranslate * (index / Math.max(1, SIX_STEPS.length - 1));
    window.scrollTo({ top: targetY, behavior: "smooth" });
  }, [mobileFallback]);

  useEffect(() => {
    const mobileQuery = window.matchMedia(MOBILE_FALLBACK_QUERY);
    const syncMobileMode = () => setMobileFallback(mobileQuery.matches);
    syncMobileMode();
    mobileQuery.addEventListener("change", syncMobileMode);
    return () => mobileQuery.removeEventListener("change", syncMobileMode);
  }, []);

  useEffect(() => {
    recalc();

    const onScroll = () => requestUpdate();
    const onResize = () => recalc();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    let resizeObserver: ResizeObserver | undefined;
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(recalc);
      if (stickyRef.current) {
        resizeObserver.observe(stickyRef.current);
      }
      if (trackRef.current) {
        resizeObserver.observe(trackRef.current);
      }
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [recalc, requestUpdate]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const { sectionTop, maxTranslate } = metricsRef.current;
      const scrollY = window.scrollY;
      const isInStickyRange =
        maxTranslate > 0 && scrollY >= sectionTop && scrollY <= sectionTop + maxTranslate;
      if (!isInStickyRange) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollToIndex(Math.min(activeIndexRef.current + 1, SIX_STEPS.length - 1));
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollToIndex(Math.max(activeIndexRef.current - 1, 0));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scrollToIndex]);

  useEffect(() => {
    if (!mobileFallback) {
      return;
    }

    const track = trackRef.current;
    if (!track) {
      return;
    }

    const updateMobileActive = () => {
      const slides = Array.from(track.querySelectorAll<HTMLElement>("[data-six-slide]"));
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let nextIndex = 0;
      let best = Infinity;
      slides.forEach((slide, index) => {
        const slideRect = slide.getBoundingClientRect();
        const slideCenter = slideRect.left + slideRect.width / 2;
        const dist = Math.abs(slideCenter - center);
        if (dist < best) {
          best = dist;
          nextIndex = index;
        }
      });
      setActiveIndexIfChanged(nextIndex);
    };

    updateMobileActive();
    track.addEventListener("scroll", updateMobileActive, { passive: true });
    return () => track.removeEventListener("scroll", updateMobileActive);
  }, [mobileFallback, setActiveIndexIfChanged]);

  return (
    <section
      id="loop"
      className="horizontalScrollSection l-band--six-steps"
      ref={sectionRef}
      aria-label="Шесть шагов процесса KISS PM"
      data-native-vertical-scroll
    >
      <div className="stickyViewport six-steps" ref={stickyRef}>
        <header className="sectionHeader six-steps-head">
          {/* без data-text-reveal: скрипт реврайтит DOM до гидрации React и ломает hydration */}
          <h2 id="loop-title" className="l-display six-steps-head__title">
            Шесть шагов · один язык
          </h2>
        </header>

        <div className="carouselMask">
          <div className="six-steps__viewport" ref={maskRef}>
            <div className="cardsTrack six-steps__track" ref={trackRef}>
              {SIX_STEPS.map((step, index) => (
                <StepCard key={step.id} step={step} active={index === activeIndex} />
              ))}
            </div>
          </div>
        </div>

        <StepProgress active={activeIndex} onSelect={scrollToIndex} />
        <div className="six-steps__access">
          <a className="l-btn l-btn--primary" href="#waitlist">
            Запросить доступ
          </a>
        </div>
      </div>
    </section>
  );
}
