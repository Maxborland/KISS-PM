/**
 * Horizontal scroll rails:
 *  - edge fade hints (data-hscroll-left / data-hscroll-right)
 *  - dot indicators that reflect snap position
 *  - native horizontal overflow for touch/trackpad without wheel hijacking
 */

const HSCROLL_SELECTOR = "[data-hscroll]";
const FADE_THRESHOLD_PX = 8;

interface RailRefs {
  wrap: HTMLElement;
  rail: HTMLElement;
  dots: HTMLButtonElement[];
}

function collectDots(wrap: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    wrap.querySelectorAll<HTMLButtonElement>("[data-hscroll-dot]")
  );
}

function updateFades(refs: RailRefs): void {
  const { wrap, rail } = refs;
  const left = rail.scrollLeft;
  const right = rail.scrollWidth - rail.clientWidth - rail.scrollLeft;
  wrap.dataset.hscrollLeft = left > FADE_THRESHOLD_PX ? "true" : "false";
  wrap.dataset.hscrollRight = right > FADE_THRESHOLD_PX ? "true" : "false";
}

function updateDots(refs: RailRefs): void {
  const items = Array.from(
    refs.rail.querySelectorAll<HTMLElement>("[data-hscroll-item]")
  );
  if (!items.length || !refs.dots.length) {
    return;
  }
  const railRect = refs.rail.getBoundingClientRect();
  let activeIndex = 0;
  let bestDelta = Infinity;
  items.forEach((item, idx) => {
    const itemRect = item.getBoundingClientRect();
    const delta = Math.abs(itemRect.left - railRect.left);
    if (delta < bestDelta) {
      bestDelta = delta;
      activeIndex = idx;
    }
  });
  refs.dots.forEach((dot, idx) => {
    if (idx === activeIndex) {
      dot.setAttribute("aria-current", "true");
    } else {
      dot.removeAttribute("aria-current");
    }
  });
}

function bindDots(refs: RailRefs): void {
  const items = Array.from(
    refs.rail.querySelectorAll<HTMLElement>("[data-hscroll-item]")
  );
  refs.dots.forEach((dot, idx) => {
    dot.addEventListener("click", () => {
      const item = items[idx];
      if (!item) {
        return;
      }
      refs.rail.scrollTo({
        left: item.offsetLeft - refs.rail.offsetLeft,
        behavior: "smooth",
      });
    });
  });
}

/** Подключает fade-hints и dots для одной пары wrap/rail. */
export function bindHorizontalRail(
  wrap: HTMLElement,
  rail: HTMLElement
): () => void {
  const refs: RailRefs = {
    wrap,
    rail,
    dots: collectDots(wrap),
  };

  const update = (): void => {
    updateFades(refs);
    updateDots(refs);
  };

  update();
  rail.addEventListener("scroll", update, { passive: true });
  const onResize = (): void => update();
  window.addEventListener("resize", onResize);
  bindDots(refs);

  let ro: ResizeObserver | undefined;
  if ("ResizeObserver" in window) {
    ro = new ResizeObserver(update);
    ro.observe(rail);
  }

  return () => {
    rail.removeEventListener("scroll", update);
    window.removeEventListener("resize", onResize);
    ro?.disconnect();
  };
}

export function initHorizontalScroll(): void {
  const wraps = document.querySelectorAll<HTMLElement>(HSCROLL_SELECTOR);
  if (!wraps.length) {
    return;
  }

  wraps.forEach((wrap) => {
    const rail = wrap.querySelector<HTMLElement>("[data-hscroll-rail]");
    if (!rail) {
      return;
    }
    bindHorizontalRail(wrap, rail);
  });
}
