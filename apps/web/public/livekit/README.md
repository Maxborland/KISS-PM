# Self-hosted LiveKit media assets (no external CDN)

Virtual backgrounds (`@livekit/track-processors`) need MediaPipe assets served
from our own origin instead of a public CDN, per the no-external-integrations rule.

## Setup

```bash
pnpm --filter @kiss-pm/web livekit:assets
```

This copies the MediaPipe `tasks-vision` WASM from `node_modules` into `wasm/`.

You must also place the selfie-segmentation model here:

```
public/livekit/selfie_segmenter.tflite
```

Download it from the official MediaPipe **Selfie Segmenter** model card and commit
or deploy it alongside the app (or fetch it during your build).

## Graceful degradation

The `lib/call/call-background.ts` controller points `assetPaths` at `/livekit/wasm`
and `/livekit/selfie_segmenter.tflite`. Until both the `wasm/` directory and the
model are present, the "Фон" control remains visible (browser capability gate) but
background effects silently no-op — never a broken effect.

## Files

- `wasm/` — MediaPipe tasks-vision runtime (populated by `livekit:assets`, gitignored binaries).
- `selfie_segmenter.tflite` — segmentation model (you provide).
- `backgrounds/studio.svg` — default virtual-background image (text SVG, no binary).
