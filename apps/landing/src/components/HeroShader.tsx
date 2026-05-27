import { useEffect, useRef } from "react";
import { createShader, type PresetConfig, type ShaderInstance } from "shaders/js";

function createHeroPreset(reducedMotion: boolean): PresetConfig {
  return {
    components: [
      {
        type: "Plasma",
        id: "base_zdxps6",
        props: {
          colorA: "#050510",
          colorB: "#f45bff",
          contrast: 1.11,
          density: 2.52,
          intensity: 2.5,
          speed: reducedMotion ? 0 : 4.55,
          transform: {
            edges: "wrap",
            scale: 1.06,
            rotation: 0.07,
          },
          visible: true,
          warp: 0.78,
        },
      },
      {
        type: "ColorWheel",
        id: "wheel_1dbxhpm",
        props: {
          angle: 0.44,
          colorA: "#6665ff",
          colorB: "#f45bff",
          colorC: "#8ef6ff",
          colorSpace: "oklab",
          maskSource: "base_zdxps6",
          maskType: "luminanceInverted",
          mode: "custom",
          opacity: 0.87,
          scale: 1.29,
          speed: reducedMotion ? 0 : 0.08,
          visible: true,
        },
      },
      {
        type: "ChromaFlow",
        id: "flow_1qlpuc7",
        props: {
          baseColor: "#050510",
          downColor: "#6665ff",
          intensity: 1.25,
          leftColor: "#6665ff",
          maskSource: "base_zdxps6",
          momentum: 44,
          opacity: 0.74,
          radius: 4.14,
          rightColor: "#f45bff",
          upColor: "#8ef6ff",
        },
      },
      {
        type: "DotGrid",
        id: "dots_1chphsv",
        props: {
          density: 122,
          dotSize: 0.37,
          maskSource: "wheel_1dbxhpm",
          maskType: "luminanceInverted",
          opacity: 0.76,
          twinkle: reducedMotion ? 0 : 1.01,
        },
      },
      {
        type: "ChromaticAberration",
        id: "aberration_ujvgso",
        props: {
          angle: -0.25,
          blueOffset: 1.26,
          redOffset: -1.26,
          strength: 0.57,
          visible: true,
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
      host.dataset.shaderReady = "true";
    });

    return () => {
      cancelled = true;
      shader?.destroy();
    };
  }, []);

  return (
    <div className="hero-shader" ref={hostRef} aria-hidden="true">
      <canvas className="hero-shader__canvas" ref={canvasRef} />
    </div>
  );
}
