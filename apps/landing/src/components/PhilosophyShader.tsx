import { useEffect, useRef } from "react";
import { createShader, type PresetConfig, type ShaderInstance } from "shaders/js";

/* «Ночная» пара к герою: непрерывный шёлковый поток бренд-цветов на чернилах. */
function createPhilosophyPreset(reducedMotion: boolean): PresetConfig {
  return {
    components: [
      {
        type: "FlowingGradient",
        id: "phil_flow",
        props: {
          colorA: "#05070f",
          colorB: "#4f46e5",
          colorC: "#2563eb",
          colorD: "#7dd3fc",
          colorSpace: "oklab",
          distortion: 0.85,
          seed: 7,
          speed: reducedMotion ? 0 : 1.2,
          visible: true,
        },
      },
    ],
  };
}

export default function PhilosophyShader() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let shader: ShaderInstance | null = null;

    void createShader(canvas, createPhilosophyPreset(reducedMotion), {
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
    <div className="philosophy-shader" ref={hostRef} aria-hidden="true">
      <canvas className="philosophy-shader__canvas" ref={canvasRef} />
    </div>
  );
}
