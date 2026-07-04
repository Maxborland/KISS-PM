/**
 * Плавный скролл страницы для wheel + отдельная easing-анимация для якорей.
 *
 * Не перехватываем touch/keyboard, reduced-motion, внутренние scrollable панели,
 * горизонтальные rail'ы и редактируемые поля. Так sticky storytelling sections
 * продолжают получать обычный window.scrollY, только с мягким rAF-шагом.
 */

export type SmoothScrollController = {
  scrollTo: (y: number) => void;
  sync: () => void;
};

const LINE_DELTA_PX = 16;
const MIN_WHEEL_DELTA_PX = 0.5;
const SCROLLABLE_OVERFLOW = /auto|scroll|overlay/;
const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]';

function readNumberVar(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function normalizeWheelDelta(event: WheelEvent): { x: number; y: number } {
  const multiplier =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? LINE_DELTA_PX
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? window.innerHeight
        : 1;

  return {
    x: event.deltaX * multiplier,
    y: event.deltaY * multiplier,
  };
}

function canScrollElement(el: HTMLElement, deltaY: number): boolean {
  const styles = getComputedStyle(el);
  if (!SCROLLABLE_OVERFLOW.test(styles.overflowY)) {
    return false;
  }

  if (el.scrollHeight <= el.clientHeight + 1) {
    return false;
  }

  if (deltaY < 0) {
    return el.scrollTop > 0;
  }

  if (deltaY > 0) {
    return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  }

  return false;
}

function shouldUseNativeWheel(event: WheelEvent, delta: { x: number; y: number }): boolean {
  if (event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey) {
    return true;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest(EDITABLE_SELECTOR)) {
    return true;
  }

  if (Math.abs(delta.x) > Math.abs(delta.y) && target.closest("[data-hscroll]")) {
    return true;
  }

  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    if (el instanceof HTMLElement && canScrollElement(el, delta.y)) {
      return true;
    }
  }

  return false;
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

  const getScrollLerp = () =>
    Math.max(0.04, Math.min(readNumberVar("--scroll-lerp", 0.13), 0.28));

  const getAnchorDuration = (delta: number) => {
    const min = readNumberVar("--duration-scroll-min", 640);
    const max = readNumberVar("--duration-scroll-max", 1400);
    const perPx = readNumberVar("--scroll-distance-ms", 0.36);
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

    targetY = clamp(targetY);
    const diff = targetY - currentY;
    if (Math.abs(diff) < 0.6) {
      currentY = targetY;
      window.scrollTo(0, currentY);
      rafId = null;
      return;
    }

    currentY += diff * getScrollLerp();
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

  const onWheel = (event: WheelEvent) => {
    const delta = normalizeWheelDelta(event);
    const deltaY = delta.y;

    if (Math.abs(deltaY) < MIN_WHEEL_DELTA_PX || shouldUseNativeWheel(event, delta)) {
      return;
    }

    event.preventDefault();

    if (rafId == null) {
      currentY = window.scrollY;
      targetY = currentY;
    }

    anchorAnim = null;
    targetY = clamp(targetY + deltaY);
    startLoop();
  };

  window.addEventListener("wheel", onWheel, { passive: false });

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
