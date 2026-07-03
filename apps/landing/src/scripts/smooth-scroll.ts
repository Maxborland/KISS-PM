/**
 * Плавный скролл только для якорей.
 *
 * Колёсико/трекпад не перехватываем: sticky storytelling sections должны
 * получать нативный scrollY без stale targetY и без preventDefault.
 */

export type SmoothScrollController = {
  scrollTo: (y: number) => void;
  sync: () => void;
};

function readPxVar(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function initSmoothScroll(): SmoothScrollController | null {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return null;
  }

  let currentY = window.scrollY;
  let targetY = window.scrollY;
  let rafId: number | null = null;

  let anchorAnim: {
    startTime: number;
    startY: number;
    endY: number;
    duration: number;
  } | null = null;

  const getMaxScroll = () =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  const clamp = (y: number) => Math.max(0, Math.min(y, getMaxScroll()));

  const getAnchorDuration = (delta: number) => {
    const min = readPxVar("--duration-scroll-min", 900);
    const max = readPxVar("--duration-scroll-max", 1600);
    const perPx = readPxVar("--scroll-distance-ms", 0.5);
    return Math.min(max, Math.max(min, min + Math.abs(delta) * perPx));
  };

  const sync = () => {
    currentY = window.scrollY;
    targetY = currentY;
    anchorAnim = null;
  };

  const tick = (now: number) => {
    if (anchorAnim) {
      const elapsed = now - anchorAnim.startTime;
      const progress = Math.min(elapsed / anchorAnim.duration, 1);
      const easedY =
        anchorAnim.startY + (anchorAnim.endY - anchorAnim.startY) * easeInOutCubic(progress);

      currentY = easedY;
      targetY = easedY;
      window.scrollTo(0, currentY);

      if (progress >= 1) {
        const endY = anchorAnim.endY;
        anchorAnim = null;
        currentY = endY;
        targetY = clamp(endY);
      }

      rafId = requestAnimationFrame(tick);
      return;
    }

    const diff = targetY - currentY;
    if (Math.abs(diff) < 0.6) {
      currentY = targetY;
      window.scrollTo(0, currentY);
      rafId = null;
      return;
    }

    currentY += diff;
    window.scrollTo(0, currentY);
    rafId = requestAnimationFrame(tick);
  };

  const startLoop = () => {
    if (rafId == null) {
      rafId = requestAnimationFrame(tick);
    }
  };

  const scrollTo = (y: number) => {
    sync();
    const endY = clamp(y);
    const delta = endY - currentY;

    if (Math.abs(delta) < 2) {
      return;
    }

    anchorAnim = {
      startTime: performance.now(),
      startY: currentY,
      endY,
      duration: getAnchorDuration(delta),
    };
    startLoop();
  };

  window.addEventListener("resize", () => {
    targetY = clamp(targetY);
    currentY = window.scrollY;
  });

  window.addEventListener("keydown", (event) => {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "PageDown" ||
      event.key === "PageUp" ||
      event.key === "Home" ||
      event.key === "End" ||
      event.key === " "
    ) {
      anchorAnim = null;
      requestAnimationFrame(sync);
    }
  });

  return { scrollTo, sync };
}
