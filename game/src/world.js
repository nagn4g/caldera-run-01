// The rules of CALDERA RUN, pure and deterministic: throttle/pitch/roll flight, lift and stall,
// fuel burn, engine heat from the ash plume, damage, caldera ring scanning, landing grading and
// the mission phases (scan -> return -> landed / crashed). No three.js and no DOM, so the
// screenshot autopilot and the node play-test drive exactly what a player flies.
import {
  STEP, FLIGHT, RUNWAY, SCORE, START, LANDING, SCAN_TOTAL,
} from './config.js';
import { heightAt, onRunway, ashIntensity, runwayFrame, resolveCourse } from './terrain.js';

export const PHASE_SCAN = 'SCAN';
export const PHASE_RETURN = 'RETURN';
export const PHASE_LANDED = 'LANDED';
export const PHASE_CRASHED = 'CRASHED';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_LAND = 4;
export const EVENT_STALL = 8;
export const EVENT_HEAT = 16;

const RAD = Math.PI / 180;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Shortest signed difference between two headings, in degrees (-180..180). */
export function angleDelta(a, b) {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** Compass bearing from one point to another, 0 = north (-z), increasing clockwise. */
export function bearingTo(from, to) {
  return (Math.atan2(to.x - from.x, -(to.z - from.z)) * (180 / Math.PI) + 360) % 360;
}

export function createWorld(seed) {
  const course = resolveCourse(seed);
  const rings = course.rings;

  const state = {
    seed,
    course,
    pos: { x: START.x, y: course.startY, z: START.z },
    heading: START.heading,
    pitch: 0,
    roll: 0,
    speed: START.speed,
    throttle: 0.6,
    fuel: FLIGHT.fuelMax,
    heat: 16,
    damage: 0,
    ringIndex: 0,
    score: 0,
    lastRing: null,
    phase: PHASE_SCAN,
    landGrade: null,
    landScore: 0,
    landDetail: null,
    stall: false,
    vy: 0,
    time: 0,
    ringFlash: 0,
    toast: '',
    toastTime: 0,
    touchdown: null,
    stallTime: 0,
    heatTime: -10,
    altitude: 0,
  };

  function reset() {
    Object.assign(state, {
      pos: { x: START.x, y: course.startY, z: START.z },
      heading: START.heading, pitch: 0, roll: 0, speed: START.speed, throttle: 0.6,
      fuel: FLIGHT.fuelMax, heat: 16, damage: 0, ringIndex: 0, score: 0,
      lastRing: null, phase: PHASE_SCAN, landGrade: null, landScore: 0, landDetail: null,
      stall: false, vy: 0, time: 0, ringFlash: 0, toast: '', toastTime: 0, touchdown: null,
      stallTime: 0, heatTime: -10, altitude: 0,
    });
  }

  function say(text, seconds) {
    state.toast = text;
    state.toastTime = seconds;
  }

  function ground() {
    return heightAt(state.pos.x, state.pos.z, state.seed);
  }
  /**
   * Advance one fixed step. `controls` may be partial: pitch -1..1, roll -1..1, throttle 0..1.
   * Returns a bitmask of EVENT_* flags raised this step.
   */
  function step(dt, controls = {}) {
    if (state.phase === PHASE_LANDED || state.phase === PHASE_CRASHED) return 0;
    let events = 0;
    const flight = FLIGHT;
    const pitchIn = clamp(controls.pitch ?? 0, -1, 1);
    const rollIn = clamp(controls.roll ?? 0, -1, 1);
    const throttleIn = clamp(controls.throttle ?? state.throttle, 0, 1);
    state.throttle += (throttleIn - state.throttle) * Math.min(1, dt * 3.4);

    const speedRatio = clamp(state.speed / flight.cruiseSpeed, 0.5, 1.4);
    const lift = clamp((state.speed - flight.stallSpeed * 0.85) / (flight.stallSpeed * 0.55), 0, 1);
    const stalled = state.speed < flight.stallSpeed;

    state.pitch += (pitchIn * flight.pitchLimit - state.pitch) * Math.min(1, dt * 4.4);
    state.roll += (rollIn * flight.bankLimit - state.roll) * Math.min(1, dt * 4);

    // Banking turns the nose; the harder the bank the more speed it scrubs off.
    state.heading += (state.roll / flight.bankLimit) * flight.turnRate * speedRatio * (180 / Math.PI) * dt;
    state.heading = (state.heading + 360) % 360;

    const targetSpeed = flight.minSpeed + state.throttle * (flight.maxSpeed - flight.minSpeed);
    state.speed += clamp(targetSpeed - state.speed, -1, 1) * 15 * dt;
    state.speed -= Math.sin(state.pitch) * flight.climbSpeedCost * dt;
    state.speed -= Math.abs(state.roll / flight.bankLimit) * flight.turnSpeedBleed * dt;
    state.speed = clamp(state.speed, 0, flight.maxSpeed + 16);

    // Climb only as fast as the wing can carry the weight; stalling drops the nose out from under.
    const climb = Math.sin(state.pitch) * state.speed * (0.35 + lift);
    const sink = stalled ? -22 : -flight.gravitySink * (1.4 - lift);
    state.vy = climb + sink;

    state.pos.x += Math.sin(state.heading * RAD) * state.speed * dt;
    state.pos.z -= Math.cos(state.heading * RAD) * state.speed * dt;
    state.pos.y += state.vy * dt;
    state.altitude = state.pos.y - ground();

    // Fuel and heat are the sortie's real decisions: the low ash route is short and hot.
    state.fuel = Math.max(0, state.fuel - (flight.idleBurn + flight.throttleBurn * state.throttle) * dt);
    const ash = ashIntensity(state.pos.x, state.pos.y, state.pos.z);
    const heatRate = ash * flight.heatGain - flight.heatCool * (1 - ash * 0.5);
    state.heat = clamp(state.heat + heatRate * dt, 0, flight.heatCap);
    if (state.heat >= 80) {
      state.damage = clamp(state.damage + flight.overheatDamage * (state.heat / 100) * dt, 0, flight.maxDamage);
      if (state.time - state.heatTime > 4) {
        state.heatTime = state.time;
        say('ENGINE HEAT — CLIMB OUT OF THE ASH', 2.6);
        events |= EVENT_HEAT;
      }
    }

    state.stallTime = stalled ? state.stallTime + dt : 0;
    if (state.stallTime > 0.4 && state.stallTime - dt <= 0.4) {
      say('STALL — LOWER THE NOSE', 2.2);
      events |= EVENT_STALL;
    }
    state.stall = stalled;

    if (state.toastTime > 0) state.toastTime = Math.max(0, state.toastTime - dt);
    if (state.ringFlash > 0) state.ringFlash = Math.max(0, state.ringFlash - dt);
    state.time += dt;

    if (state.fuel <= 0) return fail('OUT OF FUEL', 'FUEL') | events;

    events |= checkSurface();
    if (state.phase === PHASE_CRASHED || state.phase === PHASE_LANDED) return events;
    events |= checkRings();
    return events;
  }

  function fail(message, grade) {
    state.phase = PHASE_CRASHED;
    state.landGrade = grade;
    say(message, 999);
    return EVENT_CRASH;
  }

  /** Ground contact: a wheels-on touchdown on the pad, or a terrain/water impact anywhere else. */
  function checkSurface() {
    const g = ground();
    const alt = state.pos.y - g;
    if (alt > 5) return 0;
    const frame = runwayFrame(state.pos.x, state.pos.z);
    const onPad = Math.abs(frame.across) < RUNWAY.width / 2 && Math.abs(frame.along) < RUNWAY.length / 2;
    if (onPad && alt < 3.4 && state.vy < 8) {
      return touchdown(frame);
    }
    if (alt < 1.1) {
      const soft = state.speed < 30 && state.vy > -5 && g < 2;
      state.damage = clamp(state.damage + (soft ? 30 : 90), 0, FLIGHT.maxDamage);
      if (soft && state.damage < FLIGHT.maxDamage) {
        state.pos.y = g + 1.4;
        state.speed = Math.max(FLIGHT.minSpeed, state.speed - 10);
        say('GROUND STRIKE — AIRFRAME DAMAGED', 2.2);
        return EVENT_HEAT;
      }
      return fail(g < 0 ? 'DITCHED IN THE SEA' : 'TERRAIN IMPACT', 'CRASH');
    }
    return 0;
  }

  /** Ring scan: pass within the hoop to bank the score, then the gates, then the strip. */
  function checkRings() {
    if (state.ringIndex >= rings.length) return 0;
    const ring = rings[state.ringIndex];
    const d = Math.hypot(state.pos.x - ring.x, state.pos.y - ring.y, state.pos.z - ring.z);
    if (d >= ring.r * 1.15) return 0;
    const precision = 1 - clamp(d / ring.r, 0, 1);
    const speedFit = clamp(1 - Math.abs(state.speed - FLIGHT.cruiseSpeed) / 42, 0, 1);
    const base = ring.kind === 'gate' ? SCORE.gate : SCORE.ring;
    const gain = Math.round(base + precision * SCORE.centreBonus + speedFit * SCORE.speedBonus);
    state.score += gain;
    state.lastRing = { x: ring.x, y: ring.y, z: ring.z, r: ring.r, precision, gain, kind: ring.kind };
    state.ringFlash = 1.1;
    state.ringIndex += 1;
    if (ring.kind === 'gate') {
      say(`GATE CLEARED  +${gain}`, 1.8);
    } else {
      say(`CALDERA SCAN ${state.ringIndex}/${SCAN_TOTAL}  +${gain}`, 1.8);
    }
    if (state.ringIndex === SCAN_TOTAL) {
      state.phase = PHASE_RETURN;
      say('SCAN COMPLETE — RETURN TO BASE', 3.2);
    }
    return EVENT_RING;
  }

  /** Grade the landing on alignment, centre line, speed, sink rate and touchdown zone. */
  function touchdown(frame) {
    const alignErr = Math.abs(angleDelta(state.heading, RUNWAY.heading));
    const centreErr = Math.abs(frame.across) / (RUNWAY.width / 2);
    const speedErr = Math.max(0, state.speed - FLIGHT.groundSpeedLimit);
    const sinkErr = Math.max(0, -state.vy - 2.4);
    const alongT = frame.along / (RUNWAY.length / 2);

    const alignPts = Math.max(0, 1 - alignErr / 45) * 200;
    const centrePts = Math.max(0, 1 - centreErr) * 170;
    const speedPts = Math.max(0, 1 - speedErr / 24) * 170;
    const sinkPts = Math.max(0, 1 - sinkErr / 7) * 110;
    const zonePts = Math.max(0, 1 - Math.abs(alongT + 0.6)) * 50;
    let total = alignPts + centrePts + speedPts + sinkPts + zonePts;
    total *= 1 - state.damage / 200;
    total = clamp(Math.round(total), 0, SCORE.landingMax);

    const row = LANDING.find((grade) => total >= grade.min) ?? LANDING[LANDING.length - 1];
    state.landScore = total;
    state.landGrade = row.grade;
    state.landDetail = {
      align: Math.round(alignPts), centre: Math.round(centrePts), speed: Math.round(speedPts),
      sink: Math.round(sinkPts), zone: Math.round(zonePts), total,
      alignErr: Math.round(alignErr), touchdownSpeed: Math.round(state.speed),
      sinkRate: Math.round(-state.vy * 10) / 10, label: row.label,
    };
    state.touchdown = { x: state.pos.x, z: state.pos.z };
    if (total < 170) return fail('HARD LANDING — AIRFRAME LOST', 'CRASH');

    state.score += total;
    state.phase = PHASE_LANDED;
    state.speed = Math.min(state.speed, 10);
    state.vy = 0;
    state.pos.y = ground() + 1.6;
    state.fuel = FLIGHT.fuelMax;
    state.heat = Math.min(state.heat, 24);
    say(`TOUCHDOWN  ${row.grade} — ${row.label}`, 999);
    return EVENT_LAND | EVENT_RING;
  }

  /** The next thing to fly at: the current ring, then the runway threshold, then the numbers. */
  function targetPoint() {
    if (state.ringIndex < rings.length) {
      const ring = rings[state.ringIndex];
      return { x: ring.x, y: ring.y, z: ring.z, kind: ring.kind, r: ring.r };
    }
    const rad = RUNWAY.heading * RAD;
    const lead = RUNWAY.length / 2 + 150;
    return {
      x: RUNWAY.x - Math.sin(rad) * lead,
      y: course.runwayY + 55,
      z: RUNWAY.z + Math.cos(rad) * lead,
      kind: 'runway',
      r: 70,
    };
  }

  return { state, reset, say, ground, step, targetPoint, bearingTo, rings, course };
}

/** True once every ring is scanned and the only task left is the landing. */
export function onFinal(world) {
  return world.state.ringIndex >= world.rings.length;
}

/**
 * Landing guidance for the HUD and the autopilot: cross-track offset from the extended centre
 * line, distance to the threshold, and the altitude a 3.2 degree glideslope wants right now.
 */
export function approachGuidance(world) {
  const frame = runwayFrame(world.state.pos.x, world.state.pos.z);
  const threshold = -RUNWAY.length / 2;
  const toThreshold = threshold - frame.along;
  const slope = Math.tan(3.2 * Math.PI / 180);
  return {
    along: frame.along,
    across: frame.across,
    toThreshold,
    wantY: world.course.runwayY + 2 + Math.max(0, toThreshold) * slope,
    onCentre: Math.abs(frame.across) < RUNWAY.width / 2,
    past: frame.along > threshold,
  };
}

export { STEP };
