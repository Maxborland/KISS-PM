interface InteractionMaterialOptions {
  prefersReducedMotion: boolean;
}

function trackPointerVars({
  element,
  xVar,
  yVar,
  resetX,
  resetY,
}: {
  element: HTMLElement;
  xVar: string;
  yVar: string;
  resetX: string;
  resetY: string;
}): void {
  element.addEventListener(
    "pointermove",
    (event) => {
      const rect = element.getBoundingClientRect();
      const mx = ((event.clientX - rect.left) / rect.width) * 100;
      const my = ((event.clientY - rect.top) / rect.height) * 100;
      element.style.setProperty(xVar, `${mx}%`);
      element.style.setProperty(yVar, `${my}%`);
    },
    { passive: true },
  );

  element.addEventListener("pointerleave", () => {
    element.style.setProperty(xVar, resetX);
    element.style.setProperty(yVar, resetY);
  });
}

export function initInteractionMaterial({
  prefersReducedMotion,
}: InteractionMaterialOptions): void {
  if (prefersReducedMotion) {
    return;
  }

  document.querySelectorAll<HTMLElement>(".kp-spotlight-card").forEach((card) => {
    trackPointerVars({
      element: card,
      xVar: "--mx",
      yVar: "--my",
      resetX: "50%",
      resetY: "-20%",
    });
  });

  document
    .querySelectorAll<HTMLElement>(".l-btn--primary, .l-btn--ghost, .wl__submit")
    .forEach((button) => {
      trackPointerVars({
        element: button,
        xVar: "--btn-mx",
        yVar: "--btn-my",
        resetX: "50%",
        resetY: "50%",
      });
    });
}
