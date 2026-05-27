/**
 * Horizontal scroll rails:
 *  - edge fade hints (data-hscroll-left / data-hscroll-right)
 *  - dot indicators that reflect snap position
 *  - desktop wheel-to-horizontal remap on opt-in (data-hscroll-wheel)
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

function bindWheelRemap(refs: RailRefs): void {
  if (refs.wrap.dataset.hscrollWheel !== "true") {
    return;
  }
  refs.rail.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }
      const canScroll =
        refs.rail.scrollWidth - refs.rail.clientWidth - refs.rail.scrollLeft > 1 ||
        refs.rail.scrollLeft > 1;
      if (!canScroll) {
        return;
      }
      event.preventDefault();
      refs.rail.scrollLeft += event.deltaY;
    },
    { passive: false }
  );
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
    window.addEventListener("resize", update);
    bindDots(refs);
    bindWheelRemap(refs);

    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(update);
      ro.observe(rail);
    }
  });
}
