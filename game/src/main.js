// Boot and the one loop: input is read each frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), then the renderer and HUD paint what is there.
// ?seed=N fixes the islands and the course. ?shot=cover|approach|ring|vista stages a screenshot
// scene instead of the live loop, paints it twice and sets window.__shotReady.
import { STEP } from './config.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const view = document.getElementById('game');
const overlay = document.getElementById('hud');
const status = document.getElementById('status');

const world = createWorld(seed);
const renderer = createRenderer(view, seed);
const hud = createHud(overlay);

function layout() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.resize(width, height);
  hud.resize(width, height);
}
window.addEventListener('resize', layout);
layout();

function announce(text) {
  if (status) status.textContent = text;
}

function runShot(name) {
  const secParam = Number.parseFloat(params.get('sec') ?? '');
  const { world: staged, label, camera } = stageShot(name, seed, secParam);
  window.__debug = { world, renderer, camera };
  Object.assign(world.state, staged.state);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, 1 / 60, painted === 0, camera);
    hud.draw(world, { label });
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(view, (action) => {
    if (action === 'restart') {
      world.reset();
      announce('Mission restarted');
    }
  });
  let last = performance.now();
  let accumulator = 0;
  let announcedPhase = '';

  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    const controls = input.read(elapsed);
    while (accumulator >= STEP) {
      world.step(STEP, controls);
      accumulator -= STEP;
    }
    renderer.draw(world.state, elapsed);
    hud.draw(world);

    if (world.state.phase !== announcedPhase) {
      announcedPhase = world.state.phase;
      if (announcedPhase === 'LANDED') announce(`Landed: grade ${world.state.landGrade}, ${world.state.score} points`);
      if (announcedPhase === 'CRASHED') announce(`Mission failed: ${world.state.toast}`);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
