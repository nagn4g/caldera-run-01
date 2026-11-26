// The mission autopilot the screenshot scenes fly, and a fair stand-in for a player: it chases
// the current ring, looks ahead for terrain so it does not fly into a ridge, then joins the
// extended runway centre line and follows a 3.2 degree glideslope down to the threshold. Pure
// logic, seeded only by the world it is given, so every frame it produces is reproducible.
import { FLIGHT, RUNWAY } from './config.js';
import { heightAt } from './terrain.js';
import { approachGuidance, bearingTo } from './world.js';

const RAD = Math.PI / 180;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Highest ground along the next few seconds of track, so the autopilot clears ridges early. */
export function terrainAhead(world, distance) {
  const step = 45;
  let peak = -Infinity;
  for (let d = 0; d <= distance; d += step) {
    const x = world.state.pos.x + Math.sin(world.state.heading * RAD) * d;
    const z = world.state.pos.z - Math.cos(world.state.heading * RAD) * d;
    peak = Math.max(peak, heightAt(x, z, world.state.seed));
  }
  return peak;
}

/** Heading error, in degrees (-180..180), toward a bearing. */
function headingError(world, bearing) {
  return ((bearing - world.state.heading + 540) % 360) - 180;
}

/**
 * One frame of sticks. Returns { pitch, roll, throttle } in -1..1 / 0..1, aimed at the current
 * ring or, once the scan is done, at the runway centre line.
 */
export function autopilot(world) {
  const state = world.state;
  const target = world.targetPoint();
  const dist = Math.hypot(target.x - state.pos.x, target.z - state.pos.z);
  const look = 130 + state.speed * 4.2;
  const ridge = terrainAhead(world, look);

  let wantY;
  let bearing;
  if (target.kind === 'runway') {
    // Track the extended centre line: steer along the runway heading, nudged by cross-track error.
    const guide = approachGuidance(world);
    const correction = clamp(guide.across / 4, -30, 30);
    bearing = (RUNWAY.heading + correction + 360) % 360;
    if (guide.toThreshold > 900) bearing = bearingTo(state.pos, target);
    wantY = Math.max(guide.wantY, world.course.runwayY + 4);
    // Only clear ridges while still out on the approach; over the pad the glideslope is king.
    if (guide.toThreshold > 420) wantY = Math.max(wantY, ridge + 30);
  } else {
    bearing = bearingTo(state.pos, target);
    wantY = Math.max(target.y, ridge + 60);
    if (dist < 240) wantY = Math.max(wantY, target.y);
  }

  const dh = headingError(world, bearing);
  const roll = clamp(dh / 26, -1, 1);
  // A touch of lead on the bail-out: don't roll hard right above the ground.
  const pitch = clamp((wantY - state.pos.y) / (target.kind === 'runway' ? 70 : 85), -1, 1);

  let throttle;
  if (target.kind === 'runway' && approachGuidance(world).toThreshold < 700) {
    throttle = state.speed > 40 ? 0.05 : state.speed > 34 ? 0.4 : 0.85;
  } else if (state.speed < FLIGHT.cruiseSpeed - 8) {
    throttle = 1;
  } else if (state.speed > FLIGHT.cruiseSpeed + 8) {
    throttle = 0.15;
  } else {
    throttle = 0.55;
  }
  return { pitch, roll, throttle };
}
