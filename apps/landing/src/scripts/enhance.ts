/**
 * KISS PM landing — progressive enhancements.
 *
 * - Плавный скролл (колёсико + якоря) через smooth-scroll.ts.
 * - Reveals elements with `data-reveal` once they enter the viewport.
 * - Stagger groups (`data-reveal-group`) animate children in DOM order.
 * - `data-text-reveal` — пословное появление заголовков и подзаголовков.
 * - Tracks pointer position on `.kp-spotlight-card` to drive `--mx`/`--my`.
 * - Tracks pointer position on primary CTA buttons to drive cursor-bound glow.
 *
 * Reduced-motion users get instant visibility (no animation).
 */

import { initHorizontalScroll } from "./horizontal-scroll";
import { initSmoothScroll } from "./smooth-scroll";
import { initTextReveal } from "./text-reveal";

document.documentElement.classList.add("kp-js");

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const smoothScroll = initSmoothScroll();

const SCROLL_OFFSET_EXTRA_PX = 12;

function getScrollOffset(): number {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  const headerHeight = header?.getBoundingClientRect().height ?? 0;
  return headerHeight + SCROLL_OFFSET_EXTRA_PX;
}

function scrollToHash(hash: string, pushState = true): void {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (!id) {
    return;
  }

  const target =
    id === "main"
      ? document.getElementById("main")
      : document.getElementById(id);

  if (!target) {
    return;
  }

  const top =
    target.getBoundingClientRect().top +
    window.scrollY -
    (id === "main" ? 0 : getScrollOffset());

  if (prefersReducedMotion || !smoothScroll) {
    window.scrollTo(0, top);
  } else {
    smoothScroll.scrollTo(top);
  }

  if (pushState) {
    history.pushState(null, "", `#${id}`);
  }
}

document.addEventListener(
  "click",
  (event) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
      "a[href^='#']"
    );
    if (!link || link.target === "_blank") {
      return;
    }

    const hash = link.getAttribute("href");
    if (!hash || hash === "#") {
      return;
    }

    const id = decodeURIComponent(hash.slice(1));
    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    event.preventDefault();
    scrollToHash(hash);
  },
  { passive: false }
);

initHorizontalScroll();

const textReveal = initTextReveal(prefersReducedMotion);

const notifyShell = document.querySelector<HTMLElement>(".notify-dock-shell");
const heroSection = document.getElementById("hero");

if (notifyShell && heroSection) {
  const syncNotifyVisibility = () => {
    const heroRect = heroSection.getBoundingClientRect();
    const heroCoversViewport =
      heroRect.top < window.innerHeight * 0.55 &&
      heroRect.bottom > window.innerHeight * 0.12;
    notifyShell.dataset.heroVisible = heroCoversViewport ? "true" : "false";
  };

  syncNotifyVisibility();
  window.addEventListener("scroll", syncNotifyVisibility, { passive: true });
  window.addEventListener("resize", syncNotifyVisibility, { passive: true });
}

const revealTargets = document.querySelectorAll<HTMLElement>(
  "[data-reveal], [data-reveal-group], [data-bento-group]"
);

function markRevealDone(el: HTMLElement): void {
  const duration = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--duration-reveal")
  );
  const stagger = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--reveal-stagger")
  );
  const childCount = el.matches("[data-reveal-group]")
    ? el.children.length
    : 1;
  const waitMs =
    (Number.isFinite(duration) ? duration : 820) +
    (Number.isFinite(stagger) ? stagger : 72) * Math.max(0, childCount - 1) +
    80;

  window.setTimeout(() => {
    el.dataset.revealDone = "true";
  }, waitMs);
}

function revealBentoGroups(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-bento-group]").forEach((group) => {
    if (group.dataset.revealIn !== "true") {
      group.dataset.revealIn = "true";
      markRevealDone(group);
      window.setTimeout(() => textReveal.playWithin(group), 120);
    }
  });
}

function revealElement(el: HTMLElement): void {
  if (el.dataset.revealIn === "true") {
    return;
  }
  requestAnimationFrame(() => {
    el.dataset.revealIn = "true";
    markRevealDone(el);
    textReveal.playWithin(el);
    revealBentoGroups(el);
  });
}

if (revealTargets.length) {
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach((el) => {
      el.dataset.revealIn = "true";
      el.dataset.revealDone = "true";
      el.style.opacity = "1";
      el.style.transform = "none";
      textReveal.playWithin(el);
      revealBentoGroups(el);
    });
    document.querySelectorAll<HTMLElement>("[data-bento-group]").forEach((group) => {
      group.dataset.revealIn = "true";
      group.dataset.revealDone = "true";
    });
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            revealElement(entry.target as HTMLElement);
            observer.unobserve(entry.target);
          }
        }
      },
      {
        rootMargin: "10% 0px -4% 0px",
        threshold: [0, 0.04, 0.12],
      }
    );
    revealTargets.forEach((el) => observer.observe(el));
  }
}

const spotlightCards = document.querySelectorAll<HTMLElement>(
  ".kp-spotlight-card"
);

if (spotlightCards.length && !prefersReducedMotion) {
  spotlightCards.forEach((card) => {
    card.addEventListener(
      "pointermove",
      (event) => {
        const rect = card.getBoundingClientRect();
        const mx = ((event.clientX - rect.left) / rect.width) * 100;
        const my = ((event.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty("--mx", `${mx}%`);
        card.style.setProperty("--my", `${my}%`);
      },
      { passive: true }
    );
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--mx", `50%`);
      card.style.setProperty("--my", `-20%`);
    });
  });
}

const primaryButtons = document.querySelectorAll<HTMLElement>(".l-btn--primary");

if (primaryButtons.length && !prefersReducedMotion) {
  primaryButtons.forEach((button) => {
    button.addEventListener(
      "pointermove",
      (event) => {
        const rect = button.getBoundingClientRect();
        const mx = ((event.clientX - rect.left) / rect.width) * 100;
        const my = ((event.clientY - rect.top) / rect.height) * 100;
        button.style.setProperty("--btn-mx", `${mx}%`);
        button.style.setProperty("--btn-my", `${my}%`);
      },
      { passive: true }
    );
    button.addEventListener("pointerleave", () => {
      button.style.setProperty("--btn-mx", "50%");
      button.style.setProperty("--btn-my", "50%");
    });
  });
}
