"use client";

import {
  BackgroundProcessor,
  type BackgroundProcessorWrapper,
  type SwitchBackgroundProcessorOptions,
  supportsBackgroundProcessors
} from "@livekit/track-processors";
import type { LocalVideoTrack } from "livekit-client";

import type { BackgroundMode } from "@/lib/call/types";

// Self-hosted MediaPipe assets (no external CDN). Run `pnpm livekit:assets` to
// populate public/livekit/ — see public/livekit/README.md.
const ASSET_PATHS = {
  tasksVisionFileSet: "/livekit/wasm",
  modelAssetPath: "/livekit/selfie_segmenter.tflite"
} as const;
const DEFAULT_BACKGROUND_IMAGE = "/livekit/backgrounds/studio.svg";
const BLUR_RADIUS = 12;

export function backgroundProcessorsSupported(): boolean {
  try {
    return supportsBackgroundProcessors();
  } catch {
    return false;
  }
}

/* Минимальный набор self-hosted активов, без которых BackgroundProcessor гарантированно
   не работает: entry-point WASM-рантайма tasks-vision + модель сегментации.
   (`pnpm --filter @kiss-pm/web livekit:assets` + selfie_segmenter.tflite — см. README.) */
export const BACKGROUND_ASSET_PROBE_PATHS: readonly string[] = [
  `${ASSET_PATHS.tasksVisionFileSet}/vision_wasm_internal.js`,
  `${ASSET_PATHS.tasksVisionFileSet}/vision_wasm_internal.wasm`,
  ASSET_PATHS.modelAssetPath
];

let assetsProbe: Promise<boolean> | null = null;

async function assetPresent(path: string): Promise<boolean> {
  try {
    const response = await fetch(path, { method: "HEAD" });
    if (!response.ok) return false;
    // SPA-fallback честность: 200 с HTML вместо бинарного актива = актива нет.
    const contentType = response.headers.get("content-type") ?? "";
    return !contentType.toLowerCase().startsWith("text/html");
  } catch {
    return false;
  }
}

/**
 * Runtime-проверка, что MediaPipe-активы реально развёрнуты в этой сборке (Н9).
 * Без неё контрол «Фон» выглядел бы рабочим, а эффект молча не применялся бы.
 * Результат кэшируется на время жизни страницы (активы не появляются на лету).
 */
export function backgroundAssetsAvailable(): Promise<boolean> {
  assetsProbe ??= Promise.all(BACKGROUND_ASSET_PROBE_PATHS.map(assetPresent)).then((results) =>
    results.every(Boolean)
  );
  return assetsProbe;
}

/** Сброс кэша пробы — только для тестов. */
export function resetBackgroundAssetsProbeForTests(): void {
  assetsProbe = null;
}

function optionsFor(mode: BackgroundMode): SwitchBackgroundProcessorOptions {
  if (mode === "blur") return { mode: "background-blur", blurRadius: BLUR_RADIUS };
  if (mode === "image") return { mode: "virtual-background", imagePath: DEFAULT_BACKGROUND_IMAGE };
  return { mode: "disabled" };
}

/**
 * A single background processor applied to the local camera track. All failures
 * (assets missing, weak pipeline) degrade gracefully to "none" — never a broken
 * effect. The media SDK is confined here under lib/call/*.
 */
export class CallBackgroundController {
  private processor: BackgroundProcessorWrapper | null = null;
  private track: LocalVideoTrack | null = null;
  private mode: BackgroundMode = "none";

  getMode(): BackgroundMode {
    return this.mode;
  }

  /**
   * Apply the active effect to a (re)published camera track. Handles the deferred case —
   * a mode chosen while the camera was off, so no processor existed yet — by creating it
   * here, and re-syncs an existing processor whose mode changed while it was detached.
   */
  async bind(track: LocalVideoTrack | null): Promise<void> {
    this.track = track;
    if (!track || this.mode === "none") return;
    try {
      if (!this.processor) {
        this.processor = BackgroundProcessor({ ...optionsFor(this.mode), assetPaths: { ...ASSET_PATHS } });
      } else {
        await this.processor.switchTo(optionsFor(this.mode));
      }
      await track.setProcessor(this.processor);
    } catch {
      this.mode = "none";
    }
  }

  /** Apply a background mode; returns the mode actually applied (reverts on failure). */
  async setMode(mode: BackgroundMode): Promise<BackgroundMode> {
    const track = this.track;
    if (!track) {
      this.mode = mode;
      return mode;
    }
    try {
      if (mode === "none") {
        if (this.processor) await this.processor.switchTo({ mode: "disabled" });
        this.mode = "none";
        return "none";
      }
      if (!this.processor) {
        this.processor = BackgroundProcessor({ ...optionsFor(mode), assetPaths: { ...ASSET_PATHS } });
        await track.setProcessor(this.processor);
      } else {
        await this.processor.switchTo(optionsFor(mode));
      }
      this.mode = mode;
      return mode;
    } catch {
      this.mode = "none";
      try {
        if (this.processor) await track.stopProcessor();
      } catch {
        // ignore
      }
      return "none";
    }
  }

  async dispose(): Promise<void> {
    if (this.track && this.processor) {
      try {
        await this.track.stopProcessor();
      } catch {
        // ignore
      }
    }
    this.processor = null;
    this.track = null;
    this.mode = "none";
  }
}
