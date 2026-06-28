// Copies the self-hosted MediaPipe tasks-vision WASM into public/livekit/wasm so
// virtual backgrounds run without any external CDN. See public/livekit/README.md.

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public", "livekit");
const wasmOut = join(publicDir, "wasm");

function locateTasksVisionWasm() {
  const candidates = [];
  try {
    candidates.push(dirname(require.resolve("@mediapipe/tasks-vision")));
  } catch {
    // The package `exports` map can block resolution — fall back to known paths.
  }
  candidates.push(join(here, "..", "node_modules", "@mediapipe", "tasks-vision"));
  candidates.push(join(here, "..", "..", "..", "node_modules", "@mediapipe", "tasks-vision"));

  for (const base of candidates) {
    let dir = base;
    for (let depth = 0; depth < 5; depth += 1) {
      const wasmDir = join(dir, "wasm");
      if (existsSync(wasmDir)) return wasmDir;
      dir = dirname(dir);
    }
  }
  return null;
}

mkdirSync(publicDir, { recursive: true });

const wasmSrc = locateTasksVisionWasm();
if (!wasmSrc) {
  console.error(
    "[livekit:assets] Could not locate @mediapipe/tasks-vision/wasm. " +
      "Run `pnpm --filter @kiss-pm/web add @mediapipe/tasks-vision` first."
  );
  process.exit(1);
}

mkdirSync(wasmOut, { recursive: true });
cpSync(wasmSrc, wasmOut, { recursive: true });
console.log(`[livekit:assets] Copied WASM: ${wasmSrc} -> ${wasmOut}`);

const model = join(publicDir, "selfie_segmenter.tflite");
if (!existsSync(model)) {
  console.warn(
    "[livekit:assets] Model missing: place selfie_segmenter.tflite at public/livekit/ " +
      "(MediaPipe Selfie Segmenter model card). Background effects no-op until present."
  );
}
