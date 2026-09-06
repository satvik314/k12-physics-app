// Lab 02 — Conservation of Energy (skate park)
// Concept arc: drop in → she climbs back to exactly her start height → can she
// clear the hill? → friction turns energy into heat → pick a height for a
// target bottom speed (h = v²/2g).

import { setupCanvas, startLoop, pointerPos, arrow, pill, dashedLine, clamp, fmt } from '../lib/canvas.js';
import { el, slider, toggle, button, readouts } from '../lib/ui.js';
import { createLesson } from '../lib/lesson.js';

const G = 9.8;
const XMIN = -12;
const XMAX = 12;
const DRAG_MIN = -11.5;
const DRAG_MAX = -1;
const C = { pe: '#4ade80', ke: '#ffb84d', heat: '#ff6b6b', skater: '#ffb84d', track: '#8aa0d6' };

function trackY(x) {
  if (x <= 0) return 0.08 * x * x;
  const u = (x - 6) / 2;
  return 0.05 * x * x + 5 * Math.exp(-u * u) + (x > 10 ? 1.2 * (x - 10) ** 2 : 0);
}
function trackSlope(x) {
  if (x <= 0) return 0.16 * x;
  const u = (x - 6) / 2;
  return 0.1 * x - 5 * u * Math.exp(-u * u) + (x > 10 ? 2.4 * (x - 10) : 0);
}
const HILL = (() => {
  let best = { x: 6, y: 0 };
  for (let x = 3; x <= 9; x += 0.005) {
    const y = trackY(x);
    if (y > best.y) best = { x, y };
  }
  return best;
})();

export function mountEnergyLab(root) {
  const canvas = el('canvas', { class: 'lab-canvas', 'aria-label': 'Energy skate park simulation. Drag the skater up the left ramp and release.' });
  const hint = el('div', { class: 'stage-hint' }, 'Drag the skater up the ramp · let go to drop in');
  const stage = el('div', { class: 'lab-stage' }, canvas, hint);
  const panel = el('div', { class: 'lab-panel' });
  root.append(stage, panel);
  const { ctx, size, begin } = setupCanvas(canvas);

  const S = {
    mass: 60,
    mu: 0,
    showVel: true,
    sk: { x: -8, v: 0, h0: trackY(-8), thermal: 0, released: false, grabbed: false },
    runs: 0,
    lastTurn: null, // { x, y, h0, mu }
    hillFail: false,
    hillClear: false,
    bottomSpeed: null,
    lastRun: null, // { h0, mu, bottom }
    targetSpeed: null,
    prevX: -8,
  };

  const energy = () => {
    const sk = S.sk;
    const pe = S.mass * G * trackY(sk.x);
    const ke = 0.5 * S.mass * sk.v * sk.v;
    return { pe, ke, heat: sk.thermal, total: pe + ke + sk.thermal };
  };

  // ---------- geometry ----------
  function geo() {
    const scale = Math.min((size.w - 24) / (XMAX - XMIN + 1), (size.h - 84) / 13);
    const cx = size.w / 2;
    const groundY = size.h - 28;
    return { scale, sx: (x) => cx + x * scale, sy: (y) => groundY - y * scale, groundY };
  }

  // ---------- simulation ----------
  function place(x) {
    const sk = S.sk;
    sk.x = clamp(x, DRAG_MIN, DRAG_MAX);
    sk.v = 0;
    sk.thermal = 0;
    sk.h0 = trackY(sk.x);
    sk.released = false;
    S.prevX = sk.x;
  }
  function release() {
    const sk = S.sk;
    if (sk.released) return;
    sk.released = true;
    sk.thermal = 0;
    sk.h0 = trackY(sk.x);
    S.runs++;
    S.bottomSpeed = null;
    S.lastTurn = null;
    S.lastRun = { h0: sk.h0, mu: S.mu, bottom: null };
  }
  function resetToStart() {
    const sk = S.sk;
    place(-Math.sqrt(sk.h0 / 0.08));
  }

  function stepSim(dt) {
    const sk = S.sk;
    if (!sk.released || sk.grabbed) return;
    const E0 = S.mass * G * sk.h0;
    const sub = Math.max(1, Math.ceil(dt / (1 / 600)));
    const h = dt / sub;
    for (let k = 0; k < sub; k++) {
      const slope = trackSlope(sk.x);
      const cos = 1 / Math.sqrt(1 + slope * slope);
      const sin = slope * cos;
      const atRest = Math.abs(sk.v) < 0.02;
      if (atRest && S.mu > 0 && Math.abs(sin) <= S.mu * cos) {
        sk.v = 0;
        continue;
      }
      let a = -G * sin;
      if (!atRest) a -= S.mu * G * cos * Math.sign(sk.v);
      const vPrev = sk.v;
      sk.v += a * h;
      const dx = sk.v * cos * h;
      sk.x += dx;
      sk.thermal += S.mu * S.mass * G * Math.abs(dx) / cos;

      // keep the total energy exact
      const target = E0 - S.mass * G * trackY(sk.x) - sk.thermal;
      if (target <= 0) sk.v = 0;
      else sk.v = Math.sign(sk.v || vPrev || 1) * Math.sqrt((2 * target) / S.mass);

      if (sk.x <= XMIN || sk.x >= XMAX) {
        sk.x = clamp(sk.x, XMIN, XMAX);
        sk.v = -sk.v;
      }

      // events
      if (vPrev > 0 && sk.v <= 0 && sk.x > 0) {
        S.lastTurn = { x: sk.x, y: trackY(sk.x), h0: sk.h0, mu: S.mu };
        if (sk.x < HILL.x) S.hillFail = true;
      }
      if (vPrev > 0 && sk.x > HILL.x + 0.3 && S.prevX <= HILL.x + 0.3) S.hillClear = true;
      if (S.prevX < 0 && sk.x >= 0) {
        S.bottomSpeed = Math.abs(sk.v);
        if (S.lastRun && S.lastRun.bottom == null) S.lastRun.bottom = S.bottomSpeed;
      }
      S.prevX = sk.x;
    }
  }

  // ---------- pointer ----------
  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    S.sk.grabbed = true;
    canvas.setPointerCapture(e.pointerId);
    dragTo(e);
  });
  canvas.addEventListener('pointermove', (e) => dragging && dragTo(e));
  const drop = () => {
    if (!dragging) return;
    dragging = false;
    S.sk.grabbed = false;
    release();
  };
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', () => {
    dragging = false;
    S.sk.grabbed = false;
  });
  function dragTo(e) {
    const p = pointerPos(canvas, e);
    const g = geo();
    place((p.x - size.w / 2) / g.scale);
  }

  // ---------- panel ----------
  const lessonBox = el('div');
  const massCtl = slider({ label: 'Skater mass', min: 30, max: 90, step: 5, value: S.mass, unit: ' kg', onInput: (v) => (S.mass = v) });
  const muCtl = slider({ label: 'Friction', min: 0, max: 0.1, step: 0.005, value: S.mu, format: (v) => (v === 0 ? 'none' : v.toFixed(3)), onInput: (v) => (S.mu = v) });
  const velCtl = toggle({ label: 'Velocity arrow', checked: S.showVel, onChange: (v) => (S.showVel = v) });
  const controls = el(
    'div',
    { class: 'controls' },
    el('div', { class: 'ctl-row' }, button('Drop in', release, 'btn btn-primary'), button('Back to start', resetToStart, 'btn btn-ghost')),
    massCtl.el,
    muCtl.el,
    el('div', { class: 'ctl-row' }, velCtl.el),
  );
  const ro = readouts([
    { key: 'h0', label: 'Start height', unit: 'm', digits: 2 },
    { key: 'h', label: 'Height now', unit: 'm', digits: 2 },
    { key: 'v', label: 'Speed', unit: 'm/s' },
    { key: 'bottom', label: 'Speed at bottom', unit: 'm/s', digits: 2 },
    { key: 'pe', label: 'Potential (PE)', unit: 'J', digits: 0, color: C.pe },
    { key: 'ke', label: 'Kinetic (KE)', unit: 'J', digits: 0, color: C.ke },
    { key: 'heat', label: 'Heat', unit: 'J', digits: 0, color: C.heat },
    { key: 'total', label: 'Total', unit: 'J', digits: 0 },
  ]);
  panel.append(lessonBox, controls, ro.el);

  // ---------- lesson ----------
  const lesson = createLesson({
    container: lessonBox,
    onRestart: () => {
      S.runs = 0;
      S.lastTurn = null;
      S.hillFail = false;
      S.hillClear = false;
      S.bottomSpeed = null;
      S.targetSpeed = null;
      muCtl.set(0);
      muCtl.lock(false);
      place(-8);
    },
    steps: [
      {
        title: 'Drop in',
        body: 'A skater at the top of a ramp has stored energy just from being high up: <span class="c-pe">potential energy</span>. Let it loose and it becomes <span class="c-ke">kinetic energy</span>, the energy of motion. Watch the energy bar at the top of the park.',
        setup() {
          muCtl.set(0);
          muCtl.lock(true);
          S.runs = 0;
        },
        goal: 'Drag the skater up the left ramp and let go.',
        check: () => S.runs >= 1,
        done: 'The bar never changes length: energy is <b>converted</b>, not created or destroyed. Green (height) turns into orange (speed) and back again.',
      },
      {
        title: 'How high does she get?',
        body: 'Start her high on the left, above the hill, and watch where she turns around on the right side.',
        setup() {
          S.lastTurn = null;
          place(-11);
        },
        predict: {
          question: 'On the far side she will turn around…',
          options: ['Higher than she started', 'At exactly the same height', 'Lower than she started'],
          answer: 1,
          explain: 'With no friction, all of her kinetic energy turns back into potential energy, which happens at exactly the same height. She cannot borrow energy she never had.',
        },
        goal: 'Drop in from above the hill (start height over 8 m) and let her reach the far side.',
        check: () => S.lastTurn && S.lastTurn.mu === 0 && Math.abs(S.lastTurn.y - S.lastTurn.h0) < 0.15,
        done: () => `She turned around at <b>${fmt(S.lastTurn.y, 2)} m</b>, her start height was <b>${fmt(S.lastTurn.h0, 2)} m</b>. Same height, every time, whatever the shape of the track.`,
      },
      {
        title: 'Over the hill?',
        body: () => `The hill on the right is <b>${fmt(HILL.y, 1)} m</b> tall. Whether she clears it has nothing to do with speed at the bottom or the shape of the ramp. Only one number matters. Find it.`,
        setup() {
          S.hillFail = false;
          S.hillClear = false;
          place(-7);
        },
        tasks: [
          { label: () => `Start <b>below</b> ${fmt(HILL.y, 1)} m and watch her roll back.`, check: () => S.hillFail },
          { label: () => `Start <b>above</b> ${fmt(HILL.y, 1)} m and watch her clear it.`, check: () => S.hillClear },
        ],
        done: 'The only thing that matters is <b>start height vs hill height</b>. Her potential energy at the start has to cover the potential energy the hill demands. Mass does not matter, try changing it.',
      },
      {
        title: 'Where does the energy go?',
        body: 'Real ramps have friction. Turn it up, drop in, and watch the <span class="c-heat">red</span> part of the energy bar.',
        setup() {
          muCtl.lock(false);
          S.lastTurn = null;
          S.runs = 0;
        },
        predict: {
          question: 'With friction on, how high will she get on the far side?',
          options: ['Higher than start', 'Same height', 'Lower than start'],
          answer: 2,
          explain: 'Friction converts some kinetic energy into heat, so there is less left over to turn back into height. The total is still conserved, it just includes heat now.',
        },
        goal: 'Set friction above 0.02 and drop in.',
        check: () => S.lastRun && S.lastRun.mu >= 0.02 && S.sk.thermal > 50,
        done: 'The “missing” energy did not vanish. It became <b>heat</b> in the wheels and the ramp. Add the red bar and the total is still exactly the same: <b>energy is conserved</b>.',
      },
      {
        title: 'Challenge: hit the speed',
        body: () => `Friction is off again. Choose a start height so that her speed at the bottom of the ramp is <b>${S.targetSpeed} m/s</b> (within 0.3 m/s). Watch the “speed at bottom” readout.`,
        setup() {
          muCtl.set(0);
          muCtl.lock(true);
          S.targetSpeed = [8, 9, 10, 11, 12][Math.floor(Math.random() * 5)];
          S.lastRun = null;
          S.bottomSpeed = null;
          place(-4);
        },
        goal: () => `Get a bottom speed between ${(S.targetSpeed - 0.3).toFixed(1)} and ${(S.targetSpeed + 0.3).toFixed(1)} m/s.`,
        hint: () => `At the bottom all the potential energy has become kinetic: m·g·h = ½·m·v². Mass cancels, so h = v² / (2g) = ${S.targetSpeed}² / 19.6 ≈ <b>${fmt((S.targetSpeed ** 2) / (2 * G), 2)} m</b>. Watch the start-height readout as you drag.`,
        check: () => S.lastRun && S.lastRun.mu === 0 && S.lastRun.bottom != null && Math.abs(S.lastRun.bottom - S.targetSpeed) <= 0.3,
        done: () => `Nailed it: <b>${fmt(S.lastRun.bottom, 2)} m/s</b>. Notice mass cancelled out of that formula. A 30 kg kid and a 90 kg adult reach the bottom at the same speed.`,
      },
      {
        summary: true,
        title: 'You understand energy conservation',
        body: `
          <ul class="takeaways">
            <li>Height stores <b>potential energy</b> (PE = m·g·h); motion is <b>kinetic energy</b> (KE = ½·m·v²).</li>
            <li>Without friction, PE and KE trade back and forth and the <b>total never changes</b>.</li>
            <li>Clearing a hill depends on <b>start height</b> alone, not on mass or track shape.</li>
            <li>Friction turns energy into <b>heat</b>. The total, including heat, is still conserved.</li>
          </ul>
          <div class="formulas">
            <span>PE = m g h</span>
            <span>KE = ½ m v²</span>
            <span>v at bottom = √(2 g h)</span>
          </div>`,
      },
    ],
  });

  // ---------- drawing ----------
  function draw() {
    begin();
    const g = geo();
    const { w, h } = size;
    const sk = S.sk;

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0d142b');
    sky.addColorStop(1, '#1b1f45');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // height grid
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (let m = 2; m <= 12; m += 2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(0, g.sy(m));
      ctx.lineTo(w, g.sy(m));
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(`${m} m`, 8, g.sy(m));
    }

    // track
    const pts = [];
    for (let x = XMIN; x <= XMAX + 1e-9; x += 0.05) pts.push([g.sx(x), g.sy(trackY(x))]);
    ctx.beginPath();
    pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.lineTo(pts[pts.length - 1][0], h);
    ctx.lineTo(pts[0][0], h);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, g.sy(12), 0, h);
    fill.addColorStop(0, 'rgba(110,168,255,0.18)');
    fill.addColorStop(1, 'rgba(110,168,255,0.02)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = C.track;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // hill marker
    dashedLine(ctx, g.sx(HILL.x) - 30, g.sy(HILL.y), g.sx(HILL.x) + 30, g.sy(HILL.y), 'rgba(255,255,255,0.35)', [3, 4]);
    pill(ctx, `hill top ${fmt(HILL.y, 1)} m`, g.sx(HILL.x), g.sy(HILL.y) - 16, { align: 'center', font: '600 11px Inter, system-ui, sans-serif', color: 'rgba(255,255,255,0.8)' });

    // start height line
    const sh = sk.released ? sk.h0 : trackY(sk.x);
    dashedLine(ctx, g.sx(XMIN), g.sy(sh), g.sx(XMAX), g.sy(sh), 'rgba(74,222,128,0.5)', [6, 6], 1.2);
    pill(ctx, `start ${fmt(sh, 2)} m`, g.sx(0.5), g.sy(sh) - 14, { align: 'left', color: C.pe, font: '600 11px Inter, system-ui, sans-serif' });

    // turn marker
    if (S.lastTurn && sk.released) {
      const tx = g.sx(S.lastTurn.x);
      const ty = g.sy(S.lastTurn.y);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fill();
      pill(ctx, `turned at ${fmt(S.lastTurn.y, 2)} m`, tx, ty - 22, { align: 'center', font: '600 11px Inter, system-ui, sans-serif' });
    }

    // skater
    const px = g.sx(sk.x);
    const py = g.sy(trackY(sk.x));
    const slope = trackSlope(sk.x);
    const ang = -Math.atan(slope);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = '#e8ecf8';
    ctx.beginPath();
    ctx.roundRect(-14, -5, 28, 4, 2);
    ctx.fill();
    ctx.fillStyle = '#2b3357';
    [-9, 9].forEach((wx) => {
      ctx.beginPath();
      ctx.arc(wx, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    const body = ctx.createRadialGradient(px - 3, py - 20, 2, px, py - 17, 12);
    body.addColorStop(0, '#ffe0a3');
    body.addColorStop(1, C.skater);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(px, py - 17, 11, 0, Math.PI * 2);
    ctx.fill();
    if (sk.grabbed || !sk.released) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(px, py - 12, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (S.showVel && sk.released && Math.abs(sk.v) > 0.3) {
      const cos = 1 / Math.sqrt(1 + slope * slope);
      const k = g.scale * 0.35 * Math.sign(sk.v);
      const vx = Math.abs(sk.v) * cos * k;
      const vy = Math.abs(sk.v) * slope * cos * k;
      arrow(ctx, px, py - 17, px + vx, py - 17 - vy, C.ke, 3, 9);
    }

    // energy bar HUD
    const E = energy();
    const bw = Math.min(300, w - 40);
    const bx = w / 2 - bw / 2;
    const by = 16;
    const total = Math.max(E.total, 1);
    ctx.fillStyle = 'rgba(8,12,28,0.75)';
    ctx.beginPath();
    ctx.roundRect(bx - 10, by - 8, bw + 20, 52, 10);
    ctx.fill();
    let cursor = bx;
    [
      ['pe', C.pe],
      ['ke', C.ke],
      ['heat', C.heat],
    ].forEach(([key, col]) => {
      const ww = (E[key] / total) * bw;
      ctx.fillStyle = col;
      ctx.fillRect(cursor, by, ww, 14);
      cursor += ww;
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, 14);
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = C.pe;
    ctx.fillText(`PE ${Math.round(E.pe)} J`, bx, by + 30);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.ke;
    ctx.fillText(`KE ${Math.round(E.ke)} J`, bx + bw / 2, by + 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.heat;
    ctx.fillText(`Heat ${Math.round(E.heat)} J`, bx + bw, by + 30);
  }

  startLoop(canvas, (dt) => {
    stepSim(dt);
    draw();
    const E = energy();
    ro.update({
      h0: S.sk.released ? S.sk.h0 : trackY(S.sk.x),
      h: trackY(S.sk.x),
      v: Math.abs(S.sk.v),
      bottom: S.lastRun?.bottom ?? null,
      pe: E.pe,
      ke: E.ke,
      heat: E.heat,
      total: E.total,
    });
    hint.classList.toggle('is-hidden', S.runs > 0);
    lesson.update();
  });
}
