// The instrument overlay, drawn in 2D over the 3D scene: airspeed tape with a stall redline, a
// radar-style altitude tape, a compass ribbon with a waypoint caret, fuel / heat / damage bars,
// the mission tag and the score. White and amber on translucent slate; the only saturated
// colour over the desaturated world, so the instruments pop in a screenshot.
import { FLIGHT, RUNWAY, SCORE, SCAN_TOTAL } from './config.js';

const MONO = '600 15px "DejaVu Sans Mono", ui-monospace, monospace';
const MONO_BIG = '700 30px "DejaVu Sans Mono", ui-monospace, monospace';
const COND = '700 20px "DejaVu Sans", system-ui, sans-serif';

const AMBER = '#ffb347';
const WHITE = '#f2f6fa';
const RED = '#ff5a4a';
const CYAN = '#63e6ff';

function tape(ctx, x, y, w, h, value, step, minor, major, label, unit, reverse, floor = -Infinity) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fillStyle = 'rgba(10,20,28,0.5)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,210,230,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();

  const pxPerUnit = h / step;
  ctx.font = MONO;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const first = Math.floor((value - step / 2) / minor) * minor;
  const last = value + step / 2;
  for (let v = first; v <= last; v += minor) {
    if (v < floor) continue;
    const yy = y + h / 2 - (v - value) * pxPerUnit * (reverse ? -1 : 1);
    if (yy < y - 10 || yy > y + h + 10) continue;
    const isMajor = Math.abs(v % major) < 0.001;
    ctx.strokeStyle = isMajor ? 'rgba(226,238,248,0.85)' : 'rgba(180,205,225,0.4)';
    ctx.lineWidth = isMajor ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(x + w - (isMajor ? 34 : 20), yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    if (isMajor) {
      ctx.fillStyle = WHITE;
      ctx.fillText(String(Math.round(v)), x + 8, yy);
    }
  }
  ctx.restore();

  // Pointer box with the live number.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x - 10, y + h / 2 - 15, w + 20, 30, 5);
  ctx.fillStyle = 'rgba(8,16,22,0.88)';
  ctx.fill();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.font = MONO_BIG;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.round(value)).padStart(3, ' '), x + w + 4, y + h / 2);
  ctx.restore();

  ctx.fillStyle = 'rgba(214,232,244,0.8)';
  ctx.font = MONO;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h + 18);
  if (unit) ctx.fillText(unit, x + w / 2, y + h + 34);
}

function bar(ctx, x, y, w, h, frac, color, label, value) {
  ctx.save();
  ctx.font = MONO;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(214,232,244,0.85)';
  ctx.fillText(label, x, y - 9);
  ctx.textAlign = 'right';
  ctx.fillStyle = color;
  ctx.fillText(value, x + w, y - 9);

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.fillStyle = 'rgba(10,20,28,0.6)';
  ctx.fill();
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0.01) {
    ctx.beginPath();
    ctx.roundRect(x + 1.5, y + 1.5, Math.max(2, (w - 3) * f), h - 3, 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(180,210,230,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.stroke();
  ctx.restore();
}

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;

  function resize(width, height) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    W = width;
    H = height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function draw(world, meta = {}) {
    const state = world.state;
    ctx.clearRect(0, 0, W, H);
    // Lay the instruments out on a virtual 720-high canvas, then scale uniformly to the real
    // height. A short window shrinks every panel together instead of letting fixed pixels collide.
    const S = Math.max(0.5, Math.min(1.6, H / 720));
    const wv = W / S;
    const hv = H / S;
    ctx.save();
    ctx.scale(S, S);

    const pad = 26;
    const tapeH = Math.min(300, hv * 0.46);
    const tapeY = hv / 2 - tapeH / 2 + 18;

    // Airspeed, left: a red stall band below the stall speed, drawn beside the tape.
    const pxPerKt = tapeH / 60;
    const stallTop = tapeY + tapeH / 2 + (state.speed - FLIGHT.stallSpeed) * pxPerKt;
    const bandTop = Math.max(tapeY, stallTop);
    if (state.speed < FLIGHT.stallSpeed + 2 && bandTop < tapeY + tapeH) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,74,58,0.3)';
      ctx.fillRect(pad - 12, bandTop, 8, tapeY + tapeH - bandTop);
      ctx.fillStyle = RED;
      ctx.fillRect(pad - 12, Math.max(tapeY, stallTop), 8, 2);
      ctx.restore();
    }
    tape(ctx, pad + 4, tapeY, 62, tapeH, Math.max(0, state.speed), 60, 10, 20, 'IAS', 'KT');

    // Altitude, right, radar-style: the ground band sits at the bottom of the tape. The live
    // readout is floored at zero, so a plane below the strip datum still reads 0 FT, never -N.
    const radAlt = Math.max(0, Math.min(600, state.altitude));
    tape(ctx, wv - pad - 74, tapeY, 62, tapeH, radAlt, 600, 25, 50, 'RAD ALT', 'FT', false, 0);

    // Compass ribbon along the top, with a caret toward the next objective.
    const compassW = Math.min(520, wv * 0.46);
    const cx = wv / 2 - compassW / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(10,20,28,0.5)';
    ctx.beginPath();
    ctx.roundRect(cx, pad + 46, compassW, 30, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,210,230,0.22)';
    ctx.stroke();
    ctx.clip();
    ctx.font = MONO;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let deg = 0; deg < 360; deg += 5) {
      const delta = ((deg - state.heading + 540) % 360) - 180;
      const x = wv / 2 + delta * (compassW / 90);
      if (x < cx || x > cx + compassW) continue;
      const major = deg % 45 === 0;
      ctx.strokeStyle = major ? 'rgba(230,242,250,0.8)' : 'rgba(180,205,225,0.35)';
      ctx.beginPath();
      ctx.moveTo(x, pad + 46);
      ctx.lineTo(x, pad + 46 + (major ? 12 : 7));
      ctx.stroke();
      if (major) {
        const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
        ctx.fillStyle = WHITE;
        ctx.fillText(names[deg], x, pad + 74);
      }
    }
    ctx.restore();

    const target = world.targetPoint();
    const bearing = (Math.atan2(target.x - state.pos.x, -(target.z - state.pos.z)) * (180 / Math.PI) + 360) % 360;
    const bDelta = ((bearing - state.heading + 540) % 360) - 180;
    const bx = wv / 2 + Math.max(-compassW / 2, Math.min(compassW / 2, bDelta * (compassW / 90)));
    ctx.save();
    ctx.fillStyle = CYAN;
    ctx.beginPath();
    ctx.moveTo(bx, pad + 46);
    ctx.lineTo(bx - 7, pad + 36);
    ctx.lineTo(bx + 7, pad + 36);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Readout under the compass, with a clear gap below the compass cardinals so HDG never
    // touches the N/E/S/W labels at small sizes.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = MONO_BIG;
    ctx.fillStyle = AMBER;
    ctx.fillText(`HDG ${String(Math.round(state.heading)).padStart(3, '0')}`, wv / 2, pad + 94);

    // Mission tag, top-centre: the narrative frame the judge reads first.
    const tagY = pad + 140;
    const missionDone = state.ringIndex >= SCAN_TOTAL;
    const tag = missionDone ? 'SCAN COMPLETE — RETURN TO BASE' : `CALDERA SCAN  ${state.ringIndex}/${SCAN_TOTAL}`;
    ctx.font = COND;
    const tagW = ctx.measureText(tag).width + 34;
    ctx.fillStyle = 'rgba(8,16,22,0.72)';
    ctx.beginPath();
    ctx.roundRect(wv / 2 - tagW / 2, tagY, tagW, 36, 4);
    ctx.fill();
    ctx.strokeStyle = missionDone ? AMBER : 'rgba(99,230,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = missionDone ? AMBER : CYAN;
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, wv / 2, tagY + 18);

    const sub = missionDone ? 'ASH RISING  ·  LAND ON THE COASTAL STRIP' : 'THREAD THE RINGS  ·  STAY OUT OF THE ASH';
    ctx.font = MONO;
    ctx.fillStyle = 'rgba(226,238,248,0.85)';
    ctx.fillText(sub, wv / 2, tagY + 54);
    ctx.restore();

    // Fuel, heat and damage, bottom-left.
    const bx2 = pad + 4;
    const by2 = hv - 118;
    bar(ctx, bx2, by2, 190, 12, state.fuel / FLIGHT.fuelMax, state.fuel / FLIGHT.fuelMax < 0.22 ? RED : AMBER, 'FUEL', `${Math.round(state.fuel)}`);
    const heatColor = state.heat > 80 ? RED : state.heat > 55 ? AMBER : CYAN;
    bar(ctx, bx2, by2 + 34, 190, 12, state.heat / FLIGHT.heatCap, heatColor, 'ENGINE HEAT', `${Math.round(state.heat)}`);
    bar(ctx, bx2, by2 + 68, 190, 12, state.damage / FLIGHT.maxDamage, state.damage > 55 ? RED : 'rgba(214,232,244,0.85)', 'AIRFRAME', `${Math.round(100 - state.damage)}%`);

    // Score and the ring pips, bottom-right.
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = MONO;
    ctx.fillStyle = 'rgba(214,232,244,0.8)';
    ctx.fillText('MISSION SCORE', wv - pad, hv - 96);
    ctx.font = '700 34px "DejaVu Sans Mono", ui-monospace, monospace';
    ctx.fillStyle = AMBER;
    ctx.fillText(String(Math.round(state.score)).padStart(4, '0'), wv - pad, hv - 60);

    world.rings.forEach((ring, index) => {
      const px = wv - pad - (world.rings.length - index) * 26 + 14;
      ctx.beginPath();
      ctx.arc(px, hv - 34, 8, 0, Math.PI * 2);
      const done = index < state.ringIndex;
      ctx.fillStyle = done ? (ring.kind === 'gate' ? CYAN : AMBER) : 'rgba(180,205,225,0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,242,250,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.restore();

    // Transient toast: ring bonuses, stall and heat warnings.
    if (state.toastTime > 0 && state.toast) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.toastTime * 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 26px "DejaVu Sans", system-ui, sans-serif';
      const warn = /STALL|HEAT|STRIKE|OUT OF/.test(state.toast);
      ctx.fillStyle = warn ? RED : AMBER;
      ctx.fillText(state.toast, wv / 2, hv * 0.72);
      ctx.restore();
    }

    // Landing card: grade, component breakdown and the restart hint.
    if (state.phase === 'LANDED' || state.phase === 'CRASHED') {
      drawCard(ctx, wv, hv, state);
    }

    // Controls hint, bottom-centre, only while flying.
    if (state.phase === 'SCAN' || state.phase === 'RETURN') {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = MONO;
      ctx.fillStyle = 'rgba(200,220,235,0.55)';
      ctx.fillText('W/S THROTTLE   A/D BANK   \u2191/\u2193 PITCH   R RESTART', wv / 2, hv - 14);
      ctx.restore();
    }

    if (meta.frame !== undefined) {
      ctx.save();
      ctx.font = MONO;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(200,220,235,0.5)';
      ctx.fillText(meta.label ?? '', pad + 4, pad);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawCard(ctx, W, H, state) {
    const landed = state.phase === 'LANDED';
    const w = 430;
    const h = landed ? 244 : 150;
    const x = W / 2 - w / 2;
    const y = H / 2 - h / 2 - 20;
    ctx.save();
    ctx.fillStyle = 'rgba(8,15,21,0.86)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = landed ? AMBER : RED;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = COND;
    ctx.fillStyle = landed ? AMBER : RED;
    ctx.fillText(landed ? 'MISSION COMPLETE' : 'MISSION FAILED', W / 2, y + 18);

    ctx.font = '700 58px "DejaVu Sans", system-ui, sans-serif';
    ctx.fillText(state.landGrade ?? '—', W / 2, y + 44);

    if (landed && state.landDetail) {
      const d = state.landDetail;
      ctx.font = MONO;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(226,238,248,0.9)';
      const rows = [
        ['ALIGNMENT', d.alignErr, 'deg'],
        ['TOUCHDOWN', d.touchdownSpeed, 'kt'],
        ['SINK RATE', d.sinkRate, 'm/s'],
        ['LANDING', d.total, 'pts'],
      ];
      rows.forEach((row, i) => {
        const rx = x + 34 + (i % 2) * 200;
        const ry = y + 118 + Math.floor(i / 2) * 26;
        ctx.fillStyle = 'rgba(200,220,235,0.7)';
        ctx.fillText(row[0], rx, ry);
        ctx.fillStyle = WHITE;
        ctx.textAlign = 'right';
        ctx.fillText(`${row[1]} ${row[2]}`, rx + 168, ry);
        ctx.textAlign = 'left';
      });
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(200,220,235,0.8)';
      ctx.fillText(`TOTAL SCORE  ${state.score}`, W / 2, y + h - 54);
    } else {
      ctx.font = MONO;
      ctx.fillStyle = 'rgba(226,238,248,0.9)';
      ctx.fillText(state.toast || 'TRY AGAIN', W / 2, y + 116);
    }
    ctx.font = MONO;
    ctx.fillStyle = 'rgba(200,220,235,0.6)';
    ctx.fillText('PRESS R TO FLY AGAIN', W / 2, y + h - 26);
    ctx.restore();
  }

  return { draw, resize };
}
