# 3D map benchmark (dev tool)

Measures what the 3D avalanche map costs before and while building it (Phase 2, milestones A0–A2).
It is not part of the app and is not deployed.

## Run the automatic matrix

```bash
npm run bench:map:serve          # terminal 1: serves the bench page on :4020
GPU=1 npm run bench:map          # terminal 2: real GPU (upper bound)
npm run bench:map                # terminal 2: SwiftShader software GL (worst case)
```

Options (environment variables): `PROFILES=laptop,phone`, `CONFIGS="2d;3d-aws-60-1.3-12;3d-mh-60-1.3-12"`
(`3d-<dem>-<pitch>-<exaggeration>-<dem maxzoom>`, dem = `aws` AWS Terrain Tiles or `mh` Mapterhorn).

The "phone" profile emulates a mid-range phone: phone screen and pixel density, 4× slower CPU and
fast 4G. The GPU is not slowed down, so real-GPU frame rates are optimistic for a real phone, and
software-GL results are pessimistic. A real device sits in between.

## Run it by hand on your phone

1. Start the server (`npm run bench:map:serve`) and find your PC's local IP address (`ipconfig`).
2. On a phone on the same Wi-Fi, open `http://<PC-IP>:4020/?overlay=1&mode=3d` (or `mode=2d`).
3. Tap "Run benchmark" and keep still for about 10 seconds. It shows fps, the worst frame, the time
   until the map is ready and (in Chrome) the JS heap.

Windows may ask to allow Node through the firewall the first time.

## Results

Raw runs are in `results/` (one JSON line per run). The summary and the budget derived from them are in
`PLAN.md`, section 8.8.
