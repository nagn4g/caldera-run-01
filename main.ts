// A working best-game-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. A starting point, not a winner: Block Dodger, a
// plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a title screen,
// score, lives and levels, game over and restart, flat colours and no sound. Build your own game
// (any genre, any library you vendor under game/, or none), put your 3 or 4 PNG or JPEG screenshots
// in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
import { shotTable, stageShot } from './game/src/shots.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail before copying when the deliverable itself is incomplete: a missing entry HTML, the wrong
// number of screenshots, or a screenshot over the scorer's 256 KiB cap. The messages name what to
// fix so a run never spends time writing an output the gate would reject anyway.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html missing');
}

const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((name) => statSync(join(shotsDir, name)).isFile())
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots/ must contain 3 or 4 files, found ${shots.length}`);
}
for (const name of shots) {
  const bytes = statSync(join(shotsDir, name)).size;
  if (bytes > 262144) {
    throw new Error(`screenshot ${name} is ${bytes} bytes, over the 262144-byte cap`);
  }
}

// Revision checks that run for real on every build: the four judged scenes must be four distinct
// moments, and the vista scene must be the low approach camera rather than the old top-down view.
const judged = ['cover', 'ring', 'approach', 'vista'];
const table = shotTable();
for (const name of judged) {
  if (!table[name]) throw new Error(`shot table missing judged scene "${name}"`);
}
const moments = new Set(judged.map((name) => table[name].seconds));
if (moments.size !== judged.length) {
  throw new Error(`judged shots must be distinct moments, got ${[...moments].join(', ')}`);
}
if (table.vista.camera !== 'vista') {
  throw new Error(`vista shot must use the low approach camera, found "${table.vista.camera}"`);
}

// Stage the vista frame the way the browser does and confirm it is a low, level pass: the plane
// well under a kilometre up and still in the scan, so the coast and volcano share the frame.
const vista = stageShot('vista', Number(process.env.SHOT_SEED ?? 1));
const vistaAgl = vista.world.state.pos.y - vista.world.ground();
if (vista.camera !== 'vista') throw new Error('staged vista frame did not carry the vista camera');
if (!(vistaAgl > 120 && vistaAgl < 420)) {
  throw new Error(`vista frame not a low coastal pass: ${vistaAgl.toFixed(0)} m AGL`);
}
if (vista.world.state.phase !== 'SCAN') {
  throw new Error(`vista frame should still be scanning, phase "${vista.world.state.phase}"`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
