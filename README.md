# CALDERA RUN

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/nagn4g/caldera-run-01/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/nagn4g/caldera-run-01/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A low-poly 3D seaplane mission over a volcanic archipelago. Fly five glowing scan rings
through the caldera, thread the ash plume without cooking the engine, then bring the plane
back through the return gates and land on the coastal strip. Throttle, fuel, engine heat and
airframe damage all push back, so every sortie is a trade between height, speed and time.

Pure static files: `game/index.html` plus ES modules and a vendored `three.min.js`. No build
step, no network calls at runtime, deterministic from a seed.

## Play

```sh
node serve.ts          # then open http://localhost:8080
```

Or serve the folder directly:

```sh
python3 -m http.server 8099 --directory game
# http://127.0.0.1:8099/?seed=1
```

Controls: `W`/`S` throttle, `A`/`D` bank, `↑`/`↓` pitch, `R` restart.

## Mission

- Scan all five caldera rings (`CALDERA SCAN n/5`); two sit inside the ash plume.
- Then fly the two return gates (`SCAN COMPLETE — RETURN TO BASE`).
- Land on runway 06: alignment, touchdown speed and sink rate grade the landing
  `S`–`D`; a hard hit or a crash ends the run.
- Score rewards ring passes, centre bonuses, speed and a clean landing.

## Screenshots

Real frames from the shipped build, staged with the in-game autopilot behind
`?shot=cover|ring|approach|vista&seed=1` (fixed steps, fixed seed):

- `screenshots/1-cover.jpg` — mid-bank toward the first ring, volcano ahead (cover)
- `screenshots/2-ring.jpg` — a scan ring cleared
- `screenshots/3-approach.jpg` — on the glideslope for runway 06
- `screenshots/4-vista.jpg` — the ash corridor

## Determinism

The rules in `game/src/world.js` and the terrain in `game/src/terrain.js` depend only on the
seed. Staged scenes run a fixed number of `1/60 s` steps, so the same URL always paints the
same frame; `main.ts` writes byte-identical output across runs.

## Layout

- `game/src/config.js` — flight envelope, scoring, ring course, runway, palette
- `game/src/world.js` — pure flight, fuel/heat/damage, scan and landing rules
- `game/src/terrain.js` — seeded heightfield, runway pad, course resolution
- `game/src/render.js` — three.js scene: sky, sea, terrain, rings, seaplane, chase camera
- `game/src/hud.js` — instruments overlay, scaled to viewport height
- `game/src/autopilot.js` / `game/src/shots.js` — deterministic screenshot autopilot and scenes
- `main.ts` — copies `game/` and `screenshots/` to the output dir and writes `dossier.json`

## License

MIT — see `LICENSE`.

Competition: https://make.fun/bounty/best-flight-game-20261126-0057
