import { useEffect, useRef } from "react";
import { createShader, type PresetConfig, type ShaderInstance } from "shaders/js";

function createHeroPreset(reducedMotion: boolean): PresetConfig {
  return {
    components: [
      {
        type: "Plasma",
        id: "base_zdxps6",
        props: {
          colorA: "#f8fbff",
          colorB: "#3157e8",
          colorSpace: "oklab",
          balance: 58,
          contrast: 1.18,
          density: 1.34,
          intensity: 1.28,
          speed: reducedMotion ? 0 : 1.35,
          transform: {
            edges: "wrap",
            scale: 1.12,
            rotation: 0.12,
          },
          visible: true,
          warp: 0.58,
        },
      },
      {
        type: "ChromaFlow",
        id: "flow_1qlpuc7",
        props: {
          baseColor: "#e8efff",
          downColor: "#334bd3",
          intensity: 1.25,
          leftColor: "#4f46e5",
          maskSource: "base_zdxps6",
          momentum: 52,
          opacity: 0.78,
          radius: 4.75,
          rightColor: "#1d4ed8",
          upColor: "#8ed8ff",
        },
      },
      {
        type: "DotGrid",
        id: "dots_1chphsv",
        props: {
          color: "#ffffff",
          density: 136,
          dotSize: 0.34,
          maskSource: "base_zdxps6",
          maskType: "luminanceInverted",
          opacity: 0.34,
          twinkle: reducedMotion ? 0 : 0.55,
        },
      },
    ],
  };
}

export default function HeroShader() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let shader: ShaderInstance | null = null;

    void createShader(canvas, createHeroPreset(reducedMotion), {
      toneMapping: "aces",
    }).then((instance) => {
      if (cancelled) {
        instance.destroy();
        return;
      }

      shader = instance;

      const syncSize = () => {
        const rect = host.getBoundingClientRect();
        instance.resize(rect.width, rect.height);
      };

      syncSize();
      requestAnimationFrame(syncSize);
      host.dataset.shaderReady = "true";
    });

    const resizeObserver = new ResizeObserver(() => {
      const rect = host.getBoundingClientRect();
      shader?.resize(rect.width, rect.height);
    });

    resizeObserver.observe(host);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      shader?.destroy();
    };
  }, []);

  return (
    <div className="hero-shader" ref={hostRef} aria-hidden="true">
      <canvas className="hero-shader__canvas" ref={canvasRef} />
    </div>
  );
}
