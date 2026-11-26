// Screenshot staging behind ?shot=cover|approach|ring|vista (with start|play|end accepted as
// aliases). Each scene runs the REAL rules forward from a fresh world, steered by the same
// mission autopilot the game ships, so every frame is what the game actually looks like. A
// fixed step count and a fixed seed mean the same URL always yields the same frame.
import { createWorld } from './world.js';
import { autopilot } from './autopilot.js';

const STEP = 1 / 60;

/**
 * Shot table: how many simulated seconds each scene flies, and what the HUD should print.
 * `cover` catches the plane mid-bank toward the first ring with the volcano ahead; `ring`
 * stops a moment after a scan; `approach` is on the glideslope; `vista` is the wide view.
 */
const SCENES = {
  cover: { seconds: 27.2, label: 'CALDERA SCAN — EAST SHOULDER' },
  ring: { seconds: 41.95, label: 'RING 1 SCAN' },
  approach: { seconds: 219, label: 'FINAL APPROACH — RWY 06' },
  vista: { seconds: 96, label: 'ASH CORRIDOR' },
  start: { seconds: 27.2, label: 'CALDERA SCAN — EAST SHOULDER' },
  play: { seconds: 41.95, label: 'RING 1 SCAN' },
  end: { seconds: 246, label: 'TOUCHDOWN' },
};

/**
 * Fly a fresh world for a scene's fixed duration using the mission autopilot and return the
 * settled world plus the HUD label for that frame.
 */
export function stageShot(name, seed, secondsOverride) {
  const scene = SCENES[name] ?? SCENES.cover;
  const seconds = Number.isFinite(secondsOverride) ? secondsOverride : scene.seconds;
  const world = createWorld(seed);
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, autopilot(world));
  }
  return { world, label: scene.label };
}

export const SHOT_NAMES = Object.keys(SCENES);
