"use client";

import { detectFillSeries } from "@kiss-pm/planning-client";
import { useCallback, useState } from "react";

export function useDragFill() {
  const [isDragging, setIsDragging] = useState(false);

  const buildFillValues = useCallback((seed: string, count: number) => {
    const series = detectFillSeries(seed, count);
    return series.ok ? series.values : [];
  }, []);

  return { isDragging, setIsDragging, buildFillValues };
}
