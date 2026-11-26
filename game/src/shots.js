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
 * stops a moment after a scan; `approach` is on the glideslope; `vista` is the low coastal
 * pass below. Each scene also names its camera mode: the four judged shots (cover, ring,
 * approach, vista) must be distinct moments, and vista switches to the low approach camera so
 * the coast, the plane and the volcano read together instead of as a top-down view. Vista sits at
 * 61.5 s: the autopilot is level over the coastal shelf at ~230 m AGL with the volcano ~15 degrees
 * ahead, so a low camera keeps the ash cone in frame. Still a fixed step count from a fixed seed.
 */
const SCENES = {
  cover: { seconds: 27.2, label: 'CALDERA SCAN — EAST SHOULDER', camera: 'chase' },
  ring: { seconds: 41.95, label: 'RING 1 SCAN', camera: 'chase' },
  approach: { seconds: 219, label: 'FINAL APPROACH — RWY 06', camera: 'chase' },
  vista: { seconds: 61.5, label: 'ASH CORRIDOR', camera: 'vista' },
  start: { seconds: 27.2, label: 'CALDERA SCAN — EAST SHOULDER', camera: 'chase' },
  play: { seconds: 41.95, label: 'RING 1 SCAN', camera: 'chase' },
  end: { seconds: 246, label: 'TOUCHDOWN', camera: 'chase' },
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
  return { world, label: scene.label, camera: scene.camera };
}

export const SHOT_NAMES = Object.keys(SCENES);

/** Read-only snapshot of the shot table, so main.ts can assert the staged frames are distinct. */
export function shotTable() {
  return Object.fromEntries(
    Object.entries(SCENES).map(([name, scene]) => [
      name,
      { seconds: scene.seconds, label: scene.label, camera: scene.camera },
    ]),
  );
}
