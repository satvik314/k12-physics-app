// Lab 01 — Projectile Motion
// Concept arc: launch → split velocity into horizontal/vertical → freeze at the
// apex → angle experiment (45° and complementary angles) → hit-the-target challenge.

import { setupCanvas, startLoop, pointerPos, arrow, pill, dashedLine, clamp, fmt } from '../lib/canvas.js';
import { el, slider, toggle, button, readouts } from '../lib/ui.js';
import { createLesson } from '../lib/lesson.js';

const G = 9.8;
const WORLD_W = 100; // metres of ground shown
const X_OFF = 5; // metres of margin left of the cannon
const DOT_EVERY = 0.2; // stroboscopic dot interval (s)
const C = { vx: '#6ea8ff', vy: '#ffb84d', v: 'rgba(255,255,255,0.85)', ball: '#ff6b6b', path: '#ffd166', old: ['#6ea8ff', '#b48cff', '#4ade80', '#ffb84d'] };

export function mountProjectileLab(root) {
  const canvas = el('canvas', { class: 'lab-canvas', 'aria-label': 'Projectile motion simulation. Drag from the cannon to aim and release to fire.' });
  const hint = el('div', { class: 'stage-hint' }, 'Drag from the cannon to aim · release to fire');
  const stage = el('div', { class: 'lab-stage' }, canvas, hint);
  const panel = el('div', { class: 'lab-panel' });
  root.append(stage, panel);
  const { ctx, size, begin } = setupCanvas(canvas);

  const S = {
    speed: 20,
    angle: 45,
    showVectors: false,
    showPrediction: false,
    ball: null,
    flights: [],
    paused: false,
    target: null,
    launches: 0,
    vectorFlights: 0,
    anglesTried: new Set(),
    lastLanding: null,
    aim: null,
  };

  // ---------- world ↔ screen ----------
  function geo() {
    const padL = 40;
    const padR = 14;
    const groundY = size.h - 34;
    const scale = (size.w - padL - padR) / (WORLD_W + X_OFF);
    return {
      padL,
      groundY,
      scale,
      sx: (x) => padL + (X_OFF + x) * scale,
      sy: (y) => groundY - 10 - y * scale,
    };
  }

  // ---------- simulation ----------
  function launch() {
    // A new launch always wins: an unfinished flight is simply discarded.
    const th = (S.angle * Math.PI) / 180;
    S.ball = {
      t: 0, x: 0, y: 0,
      v0: S.speed, th,
      vx: S.speed * Math.cos(th), vy: S.speed * Math.sin(th),
      path: [[0, 0]], dots: [[0, 0]], lastDot: 0,
      maxH: 0, apex: [0, 0], done: false,
      withVectors: S.showVectors,
    };
    S.paused = false;
    S.launches++;
    S.anglesTried.add(Math.round(S.angle));
  }

  function stepBall(dt) {
    const b = S.ball;
    if (!b || b.done || S.paused) return;
    b.t += dt;
    const cos = Math.cos(b.th);
    const sin = Math.sin(b.th);
    b.x = b.v0 * cos * b.t;
    b.y = b.v0 * sin * b.t - 0.5 * G * b.t * b.t;
    b.vx = b.v0 * cos;
    b.vy = b.v0 * sin - G * b.t;
    while (b.t - b.lastDot >= DOT_EVERY) {
      b.lastDot += DOT_EVERY;
      b.dots.push([b.v0 * cos * b.lastDot, b.v0 * sin * b.lastDot - 0.5 * G * b.lastDot ** 2]);
    }
    if (b.y > b.maxH) {
      b.maxH = b.y;
      b.apex = [b.x, b.y];
    }
    if (b.y <= 0) {
      const T = (2 * b.v0 * sin) / G;
      b.t = T;
      b.x = b.v0 * cos * T;
      b.y = 0;
      b.vy = -b.v0 * sin;
      b.done = true;
      b.range = b.x;
      b.maxH = (b.v0 * sin) ** 2 / (2 * G);
      b.apex = [b.x / 2, b.maxH];
      b.hit = S.target ? Math.abs(b.x - S.target.x) <= S.target.r : false;
      b.path.push([b.x, 0]);
      S.lastLanding = { x: b.x, angle: S.angle, speed: b.v0, maxH: b.maxH, time: T, hit: b.hit };
      if (b.withVectors) S.vectorFlights++;
      S.flights.push({ path: b.path, angle: Math.round(S.angle), speed: b.v0, range: b.range });
      if (S.flights.length > 4) S.flights.shift();
      return;
    }
    b.path.push([b.x, b.y]);
  }

  function reset() {
    S.ball = null;
    S.flights = [];
    S.paused = false;
  }

  // ---------- pointer aiming ----------
  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (S.ball && !S.ball.done) return;
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    aimTo(e);
  });
  canvas.addEventListener('pointermove', (e) => dragging && aimTo(e));
  canvas.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    if (S.aim) launch();
    S.aim = null;
  });
  canvas.addEventListener('pointercancel', () => {
    dragging = false;
    S.aim = null;
  });

  function aimTo(e) {
    const p = pointerPos(canvas, e);
    const g = geo();
    const dx = (p.x - g.sx(0)) / g.scale;
    const dy = (g.sy(0) - p.y) / g.scale;
    const len = Math.hypot(dx, dy);
    if (len < 1.5) return;
    S.angle = clamp(Math.round((Math.atan2(dy, dx) * 180) / Math.PI), 5, 85);
    S.speed = clamp(Math.round(len * 0.8), 5, 30);
    angleCtl.set(S.angle, true);
    speedCtl.set(S.speed, true);
    S.aim = p;
  }

  // ---------- panel ----------
  const lessonBox = el('div');
  const speedCtl = slider({ label: 'Launch speed', min: 5, max: 30, step: 1, value: S.speed, unit: ' m/s', onInput: (v) => (S.speed = v) });
  const angleCtl = slider({ label: 'Launch angle', min: 5, max: 85, step: 1, value: S.angle, unit: '°', onInput: (v) => (S.angle = v) });
  const vecCtl = toggle({ label: 'Velocity arrows', checked: S.showVectors, onChange: (v) => (S.showVectors = v) });
  const predCtl = toggle({ label: 'Predicted path', checked: S.showPrediction, onChange: (v) => (S.showPrediction = v) });
  const pauseBtn = button('Pause', () => {
    if (S.ball && !S.ball.done) S.paused = !S.paused;
  }, 'btn');
  const controls = el(
    'div',
    { class: 'controls' },
    el('div', { class: 'ctl-row' }, button('Launch', launch, 'btn btn-primary'), pauseBtn, button('Clear', reset, 'btn btn-ghost')),
    speedCtl.el,
    angleCtl.el,
    el('div', { class: 'ctl-row' }, vecCtl.el, predCtl.el),
  );
  const ro = readouts([
    { key: 't', label: 'Time', unit: 's', digits: 2 },
    { key: 'x', label: 'Distance', unit: 'm' },
    { key: 'y', label: 'Height', unit: 'm' },
    { key: 'vx', label: 'v horizontal', unit: 'm/s', color: C.vx },
    { key: 'vy', label: 'v vertical', unit: 'm/s', color: C.vy },
    { key: 'maxH', label: 'Max height', unit: 'm' },
    { key: 'range', label: 'Range', unit: 'm' },
  ]);
  panel.append(lessonBox, controls, ro.el);

  // ---------- lesson ----------
  const lesson = createLesson({
    container: lessonBox,
    onRestart: () => {
      reset();
      S.target = null;
      S.launches = 0;
      S.vectorFlights = 0;
      S.anglesTried.clear();
      S.lastLanding = null;
    },
    steps: [
      {
        title: 'Fire the cannon',
        body: 'Every thrown ball, kicked football and launched rocket follows the same rule. Let’s see it before we name it.',
        goal: 'Press <b>Launch</b> (or drag from the cannon and let go) and watch the ball land.',
        setup() {
          vecCtl.set(false);
          predCtl.set(false);
          S.target = null;
        },
        check: () => S.launches >= 1,
        done: 'That curve is a <b>parabola</b>. Gravity bends every flight path the same way, no matter how hard you throw.',
      },
      {
        title: 'Two motions in one',
        body: 'Physicists cheat: they split the velocity into a <span class="c-vx">horizontal part</span> and a <span class="c-vy">vertical part</span> and study each one separately. Watch the two arrows during a flight.',
        setup() {
          vecCtl.set(true);
          S.vectorFlights = 0;
        },
        predict: {
          question: 'During the flight, which arrow changes length?',
          options: ['Only the blue (horizontal)', 'Only the orange (vertical)', 'Both'],
          answer: 1,
          explain: 'Nothing pushes the ball sideways, so the horizontal velocity never changes. Gravity only pulls down, so only the vertical velocity changes.',
        },
        goal: 'Launch with the arrows on and follow both arrows until the ball lands.',
        check: () => S.vectorFlights >= 1,
        done: 'The <span class="c-vx">blue arrow</span> stayed the same the whole time. The <span class="c-vy">orange arrow</span> shrank, hit zero at the top, then grew pointing down. That is gravity, and <em>only</em> gravity, at work.',
      },
      {
        title: 'Freeze at the top',
        body: 'The stroboscopic dots are placed every 0.2 s. Notice they are equally spaced left-to-right but not up-and-down. Now catch the ball at its peak.',
        predict: {
          question: 'At the very top of its flight the ball is…',
          options: ['Completely stopped', 'Still moving sideways', 'Moving straight up'],
          answer: 1,
          explain: 'At the peak the vertical velocity is zero for an instant, but the horizontal velocity is untouched, so the ball is still moving sideways.',
        },
        goal: 'Press <b>Pause</b> while the ball is near the top (vertical velocity within 2 m/s of zero).',
        hint: 'Use a slow launch (10–15 m/s) at a high angle so the ball hangs near the top longer. Watch the “v vertical” readout count down toward 0.',
        check: () => S.paused && S.ball && !S.ball.done && Math.abs(S.ball.vy) < 2,
        done: 'Frozen at the peak: <b>v<sub>vertical</sub> ≈ 0</b> while v<sub>horizontal</sub> is untouched. The ball never stops in the air, only its climb pauses for an instant.',
      },
      {
        title: 'The angle experiment',
        body: 'Same speed, different angles. Which one throws farthest? Use the angle slider, keep the speed fixed, and compare the landing markers.',
        setup() {
          S.paused = false;
          S.anglesTried.clear();
          predCtl.set(true);
        },
        predict: {
          question: 'With the same speed, which launch angle gives the longest range?',
          options: ['30°', '45°', '60°'],
          answer: 1,
          explain: '45° balances “time in the air” against “sideways speed”. Lower angles land fast; higher angles waste speed going up.',
        },
        goal: 'Launch at <b>30°</b>, <b>45°</b> and <b>60°</b> with the same speed.',
        check: () => [30, 45, 60].every((a) => [...S.anglesTried].some((t) => Math.abs(t - a) <= 2)),
        done: () =>
          '45° wins. Also notice <b>30° and 60° land in the same spot</b>: angles that add up to 90° always share a range. The formula that sums this up is <b>Range = v² · sin(2θ) / g</b>.',
      },
      {
        title: 'Challenge: hit the target',
        body: () => `A target has appeared at <b>${S.target.x} m</b>. Use everything you learned (and the readouts) to hit it. Any speed, any angle.`,
        setup() {
          S.target = { x: 40 + Math.round(Math.random() * 45), r: 3 };
          predCtl.set(false);
          S.lastLanding = null;
        },
        goal: () => `Land the ball within 3 m of the target centre at ${S.target.x} m.`,
        hint: () => `Range = v² · sin(2θ) / g. At 45°, sin(2θ) = 1, so you need v = √(g · range) = √(9.8 × ${S.target.x}) ≈ <b>${fmt(Math.sqrt(G * S.target.x), 1)} m/s</b>. Too fast for the slider? Keep 45° and think again… or drop the angle.`,
        check: () => S.lastLanding?.hit,
        done: '🎯 <b>Direct hit!</b> You just solved a real physics problem, the same maths used to land probes on Mars.',
      },
      {
        summary: true,
        title: 'You understand projectile motion',
        body: `
          <ul class="takeaways">
            <li>Every projectile follows a <b>parabola</b> because gravity is the only force acting.</li>
            <li><b>Horizontal velocity is constant.</b> Vertical velocity changes by 9.8 m/s every second.</li>
            <li>At the peak, vertical velocity is <b>zero</b>; horizontal velocity is not.</li>
            <li><b>45°</b> gives maximum range; complementary angles share a range.</li>
          </ul>
          <div class="formulas">
            <span>Range = v² sin(2θ) / g</span>
            <span>Max height = v² sin²θ / 2g</span>
            <span>Flight time = 2v sinθ / g</span>
          </div>`,
      },
    ],
  });

  // ---------- drawing ----------
  function draw() {
    begin();
    const g = geo();
    const { w, h } = size;

    // Ground labels stack into rows so shots with equal range never overlap.
    const placed = [];
    function groundLabel(text, x, opts = {}) {
      ctx.font = opts.font || '600 12px Inter, system-ui, sans-serif';
      const lw = ctx.measureText(text).width + 16;
      let row = 0;
      while (placed.some((q) => q.row === row && Math.abs(q.x - x) < (q.w + lw) / 2 + 6)) row++;
      placed.push({ x, w: lw, row });
      const y = g.groundY - 22 - row * 22;
      pill(ctx, text, x, y, { align: 'center', ...opts });
      return y;
    }

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0d142b');
    sky.addColorStop(1, '#172448');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    const maxY = Math.floor((g.groundY - 24) / g.scale / 10) * 10;
    for (let m = 0; m <= WORLD_W; m += 10) {
      ctx.beginPath();
      ctx.moveTo(g.sx(m), 0);
      ctx.lineTo(g.sx(m), g.groundY);
      ctx.stroke();
    }
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let m = 10; m <= maxY; m += 10) {
      ctx.beginPath();
      ctx.moveTo(g.padL, g.sy(m));
      ctx.lineTo(w, g.sy(m));
      ctx.stroke();
      ctx.fillText(`${m}`, g.padL - 6, g.sy(m));
    }

    // ground
    ctx.fillStyle = '#1d3a2b';
    ctx.fillRect(0, g.groundY, w, h - g.groundY);
    ctx.fillStyle = '#2f6b47';
    ctx.fillRect(0, g.groundY, w, 3);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let m = 0; m <= WORLD_W; m += 20) ctx.fillText(`${m} m`, g.sx(m), g.groundY + 18);

    // target
    if (S.target) {
      const tx = g.sx(S.target.x);
      const rr = S.target.r * g.scale;
      const rings = ['#ff6b6b', '#fff', '#ff6b6b', '#fff'];
      rings.forEach((col, k) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(tx, g.groundY - 4, rr * (1 - k / rings.length), rr * 0.35 * (1 - k / rings.length), 0, 0, Math.PI * 2);
        ctx.fill();
      });
      const ly = groundLabel(`target ${S.target.x} m`, tx, { color: '#ff9b9b' });
      dashedLine(ctx, tx, g.groundY - 4, tx, ly + 11, 'rgba(255,107,107,0.8)', [3, 3], 1.5);
    }

    // predicted path
    if (S.showPrediction && (!S.ball || S.ball.done) && !S.aim) {
      const th = (S.angle * Math.PI) / 180;
      const T = (2 * S.speed * Math.sin(th)) / G;
      ctx.save();
      ctx.setLineDash([3, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k <= 60; k++) {
        const t = (T * k) / 60;
        const x = S.speed * Math.cos(th) * t;
        const y = S.speed * Math.sin(th) * t - 0.5 * G * t * t;
        k ? ctx.lineTo(g.sx(x), g.sy(y)) : ctx.moveTo(g.sx(x), g.sy(y));
      }
      ctx.stroke();
      ctx.restore();
    }

    // older flights
    S.flights.forEach((f, k) => {
      if (S.ball && f.path === S.ball.path) return;
      const col = C.old[k % C.old.length];
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      f.path.forEach(([x, y], j) => (j ? ctx.lineTo(g.sx(x), g.sy(y)) : ctx.moveTo(g.sx(x), g.sy(y))));
      ctx.stroke();
      ctx.restore();
      groundLabel(`${f.angle}° · ${fmt(f.range, 1)} m`, g.sx(f.range), { color: col, font: '600 11px Inter, system-ui, sans-serif' });
    });

    // cannon
    const cx = g.sx(0);
    const cy = g.sy(0);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-S.angle * Math.PI) / 180);
    ctx.fillStyle = '#9aa5c4';
    ctx.beginPath();
    ctx.roundRect(-4, -7, 40, 14, 5);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#4b5578';
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b2140';
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // aim line
    if (S.aim) {
      dashedLine(ctx, cx, cy, S.aim.x, S.aim.y, 'rgba(255,255,255,0.6)', [4, 6], 1.5);
      pill(ctx, `${S.speed} m/s · ${S.angle}°`, S.aim.x, S.aim.y - 20, { align: 'center' });
    }

    // current flight
    const b = S.ball;
    if (b) {
      ctx.save();
      ctx.strokeStyle = C.path;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      b.path.forEach(([x, y], j) => (j ? ctx.lineTo(g.sx(x), g.sy(y)) : ctx.moveTo(g.sx(x), g.sy(y))));
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(255,209,102,0.9)';
      for (const [x, y] of b.dots) {
        ctx.beginPath();
        ctx.arc(g.sx(x), g.sy(y), 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (b.vy < 0 || b.done) {
        const ax = g.sx(b.apex[0]);
        const ay = g.sy(b.apex[1]);
        dashedLine(ctx, ax, ay, ax, g.groundY, 'rgba(255,255,255,0.3)', [3, 5]);
        pill(ctx, `max height ${fmt(b.maxH, 1)} m`, ax, ay - 18, { align: 'center', font: '600 11px Inter, system-ui, sans-serif' });
      }
      if (b.done) {
        groundLabel(`${b.hit ? '🎯 ' : ''}range ${fmt(b.range, 1)} m`, g.sx(b.range), { color: b.hit ? '#4ade80' : '#ffd166' });
      }

      const bx = g.sx(b.x);
      const by = g.sy(b.y);
      const ball = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, 8);
      ball.addColorStop(0, '#ffb3b3');
      ball.addColorStop(1, C.ball);
      ctx.fillStyle = ball;
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();

      if (S.showVectors && !b.done) {
        const k = g.scale * 0.45;
        arrow(ctx, bx, by, bx + b.vx * k, by, C.vx, 3, 9);
        arrow(ctx, bx, by, bx, by - b.vy * k, C.vy, 3, 9);
        dashedLine(ctx, bx, by, bx + b.vx * k, by - b.vy * k, C.v, [3, 4], 1.2);
        pill(ctx, `vx ${fmt(b.vx, 1)}`, bx + b.vx * k + 6, by, { color: C.vx, font: '600 11px Inter, system-ui, sans-serif' });
        pill(ctx, `vy ${fmt(b.vy, 1)}`, bx, by - b.vy * k - 14, { align: 'center', color: C.vy, font: '600 11px Inter, system-ui, sans-serif' });
      }
      if (S.paused && !b.done) pill(ctx, `⏸ paused · v vertical = ${fmt(b.vy, 1)} m/s`, w / 2, 20, { align: 'center', color: '#ffd166' });
    }
  }

  startLoop(canvas, (dt) => {
    stepBall(dt);
    draw();
    const b = S.ball;
    ro.update(b ? { t: b.t, x: b.x, y: Math.max(0, b.y), vx: b.vx, vy: b.vy, maxH: b.maxH, range: b.done ? b.range : null } : { t: null, x: null, y: null, vx: null, vy: null, maxH: null, range: null });
    pauseBtn.textContent = S.paused ? 'Resume' : 'Pause';
    hint.classList.toggle('is-hidden', S.launches > 0);
    lesson.update();
  });
}
