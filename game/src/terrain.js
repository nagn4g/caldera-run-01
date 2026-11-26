// Deterministic volcanic archipelago. Islands are explicit blobs so the course, runway and
// screenshots can be composed; seeded value noise roughens them, the green belt is terraced, and
// a stratovolcano with a lava lake crowns the middle. world.js samples this for collisions and
// render.js builds its meshes from the same functions, so what you see is what you can hit.
import {
  WORLD_SIZE, VOLCANO, RUNWAY, RING_SPECS, START, START_CLEARANCE, COLORS,
} from './config.js';

const GRID = 112;
const HALF = WORLD_SIZE / 2;

/** A small deterministic PRNG (mulberry32): same seed, same archipelago, every run. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}

function fbm(x, z, seed, octaves) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let freq = 1;
  for (let o = 0; o < octaves; o += 1) {
    sum += valueNoise(x * freq, z * freq, seed + o * 71) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/** Terraced green belt: a stepped profile so the islands read as rice terraces, not smooth hills. */
function terrace(t) {
  const steps = 5;
  const scaled = t * steps;
  const base = Math.floor(scaled);
  return (base + smooth(Math.min(1, (scaled - base) * 1.9))) / steps;
}

const ISLANDS = [
  { x: 0, z: -280, rx: 1880, rz: 1560, h: 400, rough: 0.4 },
  { x: 1780, z: 980, rx: 760, rz: 640, h: 250, rough: 0.34 },
  { x: -1720, z: -560, rx: 900, rz: 720, h: 300, rough: 0.38 },
  { x: 160, z: 2180, rx: 980, rz: 620, h: 190, rough: 0.3 },
  { x: -520, z: -2330, rx: 760, rz: 520, h: 340, rough: 0.44 },
  { x: 2460, z: -980, rx: 330, rz: 290, h: 130, rough: 0.3 },
  { x: -2180, z: 1420, rx: 420, rz: 340, h: 160, rough: 0.32 },
  { x: 1180, z: -1980, rx: 380, rz: 420, h: 220, rough: 0.34 },
];

/** Distance along/across the runway centre line, world units (positive along = toward threshold). */
export function runwayFrame(x, z) {
  const rad = (RUNWAY.heading * Math.PI) / 180;
  const fx = Math.sin(rad);
  const fz = -Math.cos(rad);
  const dx = x - RUNWAY.x;
  const dz = z - RUNWAY.z;
  return { along: dx * fx + dz * fz, across: dx * fz - dz * fx };
}

/** Terrain before the runway pad is levelled. Sea is negative. */
export function baseHeight(x, z, seed) {
  let h = -34;
  for (const isle of ISLANDS) {
    const dx = (x - isle.x) / isle.rx;
    const dz = (z - isle.z) / isle.rz;
    const d = Math.hypot(dx, dz);
    const edge = fbm(x * 0.0022, z * 0.0022, seed + 17, 3) * 0.24 - 0.12;
    const t = 1 - d + edge;
    if (t <= 0) continue;
    const rise = smooth(Math.min(1, t * 1.75));
    const detail = (fbm(x * 0.006, z * 0.006, seed + 41, 4) - 0.5) * isle.rough;
    const shaped = terrace(Math.min(1, Math.max(0, rise + detail * 0.3)));
    h = Math.max(h, -20 + (isle.h + 30) * shaped + detail * isle.h * 0.16);
  }

  const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  if (dv < VOLCANO.base) {
    const coneT = 1 - dv / VOLCANO.base;
    const ridge = (fbm(x * 0.0042, z * 0.0042, seed + 7, 3) - 0.45) * 130 * coneT;
    const crater = Math.max(0, 1 - dv / VOLCANO.crater);
    h = Math.max(h, Math.pow(coneT, 1.45) * VOLCANO.height + ridge - crater * 220);
  }
  return h;
}

/** Runway pad height: the level, dry bench the strip is carved into, fixed per seed. */
const padCache = new Map();
export function runwayHeight(seed) {
  if (padCache.has(seed)) return padCache.get(seed);
  const rad = (RUNWAY.heading * Math.PI) / 180;
  const fx = Math.sin(rad);
  const fz = -Math.cos(rad);
  let sum = 0;
  let peak = -Infinity;
  let n = 0;
  for (let a = -1; a <= 1.001; a += 0.2) {
    for (let b = -1; b <= 1.001; b += 0.5) {
      const x = RUNWAY.x + fx * a * (RUNWAY.length / 2) + fz * b * 40;
      const z = RUNWAY.z + fz * a * (RUNWAY.length / 2) - fx * b * 40;
      const h = baseHeight(x, z, seed);
      sum += h;
      peak = Math.max(peak, h);
      n += 1;
    }
  }
  const h = Math.max(10, Math.max(sum / n, peak * 0.6) + 4);
  padCache.set(seed, h);
  return h;
}

/** Final ground height: the base field with the airstrip apron blended flat into it. */
export function heightAt(x, z, seed) {
  const base = baseHeight(x, z, seed);
  const padH = runwayHeight(seed);
  const { along, across } = runwayFrame(x, z);
  const alongT = Math.abs(along) / (RUNWAY.length / 2 + RUNWAY.pad);
  const acrossT = Math.abs(across) / (RUNWAY.width / 2 + 110);
  const outer = Math.max(alongT, acrossT);
  if (outer >= 1) return base;
  const edge = 1 - smooth(outer);
  return base * (1 - edge) + padH * edge;
}

/** True when a point sits on the paved strip (for touchdown tests). */
export function onRunway(x, z) {
  const { along, across } = runwayFrame(x, z);
  return Math.abs(along) < RUNWAY.length / 2 && Math.abs(across) < RUNWAY.width / 2;
}

/** 0..1 heat field: hot low and close under the plume, cool up high and far out. */
export function ashIntensity(x, y, z) {
  const d = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  const radial = Math.pow(Math.max(0, 1 - d / 1500), 1.4);
  const vertical = Math.max(0, 1 - (y - VOLCANO.lavaY) / 980);
  return radial * vertical;
}

/** Resolved course for a seed: ring altitudes over the real ground, plus the start altitude. */
export function resolveCourse(seed) {
  const rings = RING_SPECS.map((spec) => ({
    ...spec,
    y: Math.max(80, baseHeight(spec.x, spec.z, seed) + spec.agl),
  }));
  return {
    rings,
    runwayY: runwayHeight(seed),
    startY: Math.max(START.altitude, heightAt(START.x, START.z, seed) + START_CLEARANCE),
  };
}

/**
 * Mesh-ready heightfield for the renderer: GRID x GRID vertices sampled from heightAt, a
 * per-vertex colour band (deep sea, shelf, sand, grass, jungle, rock, basalt, ash) and the face
 * index buffer. Deterministic: the seed is its only input.
 */
export function buildField(seed) {
  const step = WORLD_SIZE / (GRID - 1);
  const count = GRID * GRID;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const indices = new Uint32Array((GRID - 1) * (GRID - 1) * 6);
  const c = new THREE.Color();
  const jungle = new THREE.Color(COLORS.jungle);
  const rock = new THREE.Color(COLORS.rock);
  const basalt = new THREE.Color(COLORS.basalt);
  const shelf = new THREE.Color(COLORS.shelf);
  let p = 0;
  for (let iz = 0; iz < GRID; iz += 1) {
    for (let ix = 0; ix < GRID; ix += 1) {
      const x = -HALF + ix * step;
      const z = -HALF + iz * step;
      const y = heightAt(x, z, seed);
      positions[p] = x;
      positions[p + 1] = y;
      positions[p + 2] = z;
      if (y < -110) c.setHex(COLORS.seaDeep);
      else if (y < -3) c.setHex(COLORS.sea).lerp(shelf, Math.max(0, (y + 110) / 107));
      else if (y < 5) c.setHex(COLORS.sand);
      else if (y < 150) c.setHex(COLORS.grass).lerp(jungle, Math.min(1, (y - 5) / 150));
      else if (y < 430) c.setHex(jungle).lerp(rock, Math.min(1, (y - 150) / 240));
      else if (y < VOLCANO.lavaY - 40) c.setHex(rock).lerp(basalt, 0.6);
      else c.setHex(COLORS.ash);
      colors[p] = c.r;
      colors[p + 1] = c.g;
      colors[p + 2] = c.b;
      p += 3;
    }
  }
  let i = 0;
  for (let iz = 0; iz < GRID - 1; iz += 1) {
    for (let ix = 0; ix < GRID - 1; ix += 1) {
      const a = iz * GRID + ix;
      const b = a + 1;
      const d = a + GRID;
      const e = d + 1;
      indices[i++] = a; indices[i++] = d; indices[i++] = b;
      indices[i++] = b; indices[i++] = d; indices[i++] = e;
    }
  }
  return { grid: GRID, positions, colors, indices };
}
