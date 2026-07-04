/**
 * Пословное появление текста: каждое слово — отдельный span с плавным stagger.
 * Разметка: `data-text-reveal` на заголовке или абзаце.
 */

const WORD_SPLIT = /(\s+)/;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "SVG", "CODE"]);

export function wrapTextRevealWords(root: HTMLElement): number {
  if (root.dataset.textRevealReady === "true") {
    return Number(root.dataset.wordCount ?? 0);
  }

  let wordIndex = 0;

  function wrapTextNode(textNode: Text): void {
    const text = textNode.textContent ?? "";
    if (!text.trim()) return;

    const fragment = document.createDocumentFragment();
    for (const part of text.split(WORD_SPLIT)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        fragment.appendChild(document.createTextNode(part));
        continue;
      }
      const span = document.createElement("span");
      span.className = "kp-word";
      span.textContent = part;
      span.style.setProperty("--word-i", String(wordIndex));
      wordIndex += 1;
      fragment.appendChild(span);
    }
    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  function walk(parent: Node): void {
    for (const child of [...parent.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        wrapTextNode(child as Text);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;

      const el = child as HTMLElement;
      if (SKIP_TAGS.has(el.tagName) || el.classList.contains("kp-word")) continue;
      if (el.tagName === "BR") continue;
      walk(el);
    }
  }

  walk(root);
  root.dataset.textRevealReady = "true";
  root.dataset.wordCount = String(wordIndex);
  return wordIndex;
}

export function playTextReveal(el: HTMLElement): void {
  if (el.dataset.textRevealIn === "true") return;
  requestAnimationFrame(() => {
    el.dataset.textRevealIn = "true";
    scheduleTextRevealDone(el);
  });
}

function scheduleTextRevealDone(el: HTMLElement): void {
  const waitMs = getTextRevealTransitionMs(el) + 80;

  window.setTimeout(() => {
    el.dataset.textRevealDone = "true";
  }, waitMs);
}

function parseTransitionTimeMs(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (trimmed.endsWith("ms")) return Number.parseFloat(trimmed) || 0;
  if (trimmed.endsWith("s")) return (Number.parseFloat(trimmed) || 0) * 1000;
  return Number.parseFloat(trimmed) || 0;
}

function maxTransitionTimeMs(value: string): number {
  return Math.max(0, ...value.split(",").map(parseTransitionTimeMs));
}

function getTextRevealTransitionMs(el: HTMLElement): number {
  const words = [...el.querySelectorAll<HTMLElement>(".kp-word")];
  if (!words.length) return 0;

  return Math.max(
    ...words.map((word) => {
      const styles = getComputedStyle(word);
      return (
        maxTransitionTimeMs(styles.transitionDelay) +
        maxTransitionTimeMs(styles.transitionDuration)
      );
    }),
  );
}

export type TextRevealController = {
  playWithin: (root: ParentNode) => void;
};

export function initTextReveal(reducedMotion: boolean): TextRevealController {
  const targets = [...document.querySelectorAll<HTMLElement>("[data-text-reveal]")];
  targets.forEach(wrapTextRevealWords);

  const playWithin = (root: ParentNode): void => {
    const nodes = [
      ...(root instanceof HTMLElement && root.matches("[data-text-reveal]") ? [root] : []),
      ...root.querySelectorAll<HTMLElement>("[data-text-reveal]"),
    ];
    for (const node of nodes) {
      playTextReveal(node);
    }
  };

  if (reducedMotion) {
    targets.forEach((el) => {
      el.dataset.textRevealIn = "true";
      el.dataset.textRevealDone = "true";
    });
    return { playWithin };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        playTextReveal(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      }
    },
    {
      rootMargin: "10% 0px -6% 0px",
      threshold: [0, 0.12, 0.28],
    },
  );

  targets.forEach((target) => observer.observe(target));

  return { playWithin };
}
