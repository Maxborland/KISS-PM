"use client";

import { useEffect, useState } from "react";

export function useNarrowViewport(breakpointPx = 768) {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const sync = () => setIsNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [breakpointPx]);

  return isNarrow;
}
