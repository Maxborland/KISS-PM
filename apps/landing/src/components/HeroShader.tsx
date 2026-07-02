import { useEffect, useRef } from "react";
import { createShader, type PresetConfig, type ShaderInstance } from "shaders/js";

function createHeroPreset(reducedMotion: boolean): PresetConfig {
  return {
    components: [
      {
        type: "Plasma",
        id: "base_zdxps6",
        props: {
          colorA: "#edf0f7",
          colorB: "#3f57d4",
          contrast: 1.02,
          density: 1.12,
          intensity: 1.12,
          speed: reducedMotion ? 0 : 1.8,
          transform: {
            edges: "wrap",
            scale: 1.06,
            rotation: 0.07,
          },
          visible: true,
          warp: 0.42,
        },
      },
      {
        type: "ChromaFlow",
        id: "flow_1qlpuc7",
        props: {
          baseColor: "#edf0f7",
          downColor: "#4f46e5",
          intensity: 1.1,
          leftColor: "#4f46e5",
          maskSource: "base_zdxps6",
          momentum: 44,
          opacity: 0.65,
          radius: 4.14,
          rightColor: "#2563eb",
          upColor: "#a5d8ff",
        },
      },
      {
        type: "DotGrid",
        id: "dots_1chphsv",
        props: {
          density: 122,
          dotSize: 0.37,
          maskSource: "base_zdxps6",
          maskType: "luminanceInverted",
          opacity: 0.3,
          twinkle: reducedMotion ? 0 : 0.4,
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
