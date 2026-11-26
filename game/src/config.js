// All tuning numbers for CALDERA RUN live here: the flight envelope, fuel and heat rates,
// scoring, the ring course and the runway. Nothing else hard-codes a balance value.
// Ring and runway altitudes are terrain-relative (AGL), so the same seed is always flyable.

export const STEP = 1 / 60;
export const WORLD_SIZE = 6000;
export const SEA_LEVEL = 0;

export const FLIGHT = {
  throttleAccel: 0.9,
  minSpeed: 26,
  maxSpeed: 70,
  cruiseSpeed: 48,
  stallSpeed: 32,
  pitchRate: 0.62,
  pitchLimit: 0.5,
  bankRate: 1.05,
  bankLimit: 0.85,
  turnRate: 0.62,
  turnSpeedBleed: 6.2,
  climbSpeedCost: 14,
  diveSpeedGain: 7.5,
  gravitySink: 0.55,
  idleBurn: 0.09,
  throttleBurn: 0.40,
  fuelMax: 130,
  heatCap: 100,
  heatGain: 11,
  heatCool: 5,
  overheatDamage: 6.5,
  maxDamage: 100,
  groundSpeedLimit: 36,
  hardLandingSpeed: 6.5,
  serviceCeiling: 1100,
};

export const VOLCANO = { x: 0, z: -900, base: 1700, height: 1260, crater: 290, lavaY: 1030, plumeTop: 2300 };
export const ASH_RADIUS = 1500;

// The strip sits on the east shore, pointing up-valley at the volcano. Its pad is flattened to
// whatever terrain is there, so the runway always lies on the island.
export const RUNWAY = {
  x: 1180,
  z: 1450,
  heading: 330,
  length: 920,
  width: 48,
  pad: 300,
};

// Five caldera scan rings then two return gates. x/z lay out the course, `agl` keeps each ring a
// readable height over the ground, and `hot` marks the two that thread the ash plume.
export const RING_SPECS = [
  { x: 1850, z: 1700, agl: 210, r: 52, kind: 'scan', hot: false },
  { x: 1400, z: 900, agl: 220, r: 50, kind: 'scan', hot: false },
  { x: 600, z: 150, agl: 230, r: 48, kind: 'scan', hot: false },
  { x: -250, z: -600, agl: 280, r: 48, kind: 'scan', hot: true },
  { x: -950, z: -250, agl: 260, r: 50, kind: 'scan', hot: true },
  { x: 1980, z: 2836, agl: 200, r: 64, kind: 'gate', hot: false },
  { x: 1530, z: 2056, agl: 150, r: 68, kind: 'gate', hot: false },
];

export const SCORE = { ring: 100, centreBonus: 110, speedBonus: 50, gate: 80, landingMax: 700 };
export const SCAN_TOTAL = RING_SPECS.filter((ring) => ring.kind === 'scan').length;

export const LANDING = [
  { grade: 'S', min: 600, label: 'PERFECT' },
  { grade: 'A', min: 500, label: 'GREAT' },
  { grade: 'B', min: 400, label: 'GOOD' },
  { grade: 'C', min: 290, label: 'ROUGH' },
  { grade: 'D', min: 0, label: 'HARD' },
];

// Start abeam the strip: wings level, the first ring already ahead-left and the volcano smoking.
export const START = { x: 2160, z: 2900, altitude: 380, heading: 330, speed: 50 };
export const START_CLEARANCE = 250;

export const COLORS = {
  sea: 0x123c47,
  seaDeep: 0x0c2c36,
  shelf: 0x1b6b66,
  sand: 0xb09a6c,
  grass: 0x2c6b45,
  jungle: 0x163a2b,
  rock: 0x373d44,
  basalt: 0x2b2d34,
  ash: 0x5a5f66,
  lava: 0xff6a1e,
  lavaHot: 0xffd166,
  haze: 0x27384a,
  skyTop: 0x16233a,
  skyHorizon: 0xd99a63,
  plane: 0x1e5fd0,
  plane2: 0x0f3f96,
  orange: 0xff7a1a,
  glass: 0x9fd6e8,
};
