// Lab 03 — Waves & Superposition
// Concept arc: one wave (frequency ↔ wavelength) → amplitude → adding two waves
// (constructive) → cancelling (destructive) → beats → standing waves →
// "silence the noise" challenge.

import { setupCanvas, startLoop, pointerPos, pill, dashedLine, clamp, fmt } from '../lib/canvas.js';
import { el, slider, toggle, segmented, button, readouts } from '../lib/ui.js';
import { createLesson } from '../lib/lesson.js';

const V = 2; // wave speed (m/s)
const L = 4; // length of string shown (m)
const C = { a: '#6ea8ff', b: '#b48cff', sum: '#ffb84d', env: 'rgba(255,184,77,0.18)' };
const NX = 160;
const NT = 48;

export function mountWavesLab(root) {
  const canvas = el('canvas', { class: 'lab-canvas', 'aria-label': 'Wave superposition simulation. Drag across the waves to move the probe.' });
  const hint = el('div', { class: 'stage-hint' }, 'Drag across the waves to move the probe');
  const stage = el('div', { class: 'lab-stage' }, canvas, hint);
  const panel = el('div', { class: 'lab-panel' });
  root.append(stage, panel);
  const { ctx, size, begin } = setupCanvas(canvas);

  const S = {
    A: { amp: 0.8, f: 1, phase: 0, dir: 1 },
    B: { amp: 0.8, f: 1, phase: 0, dir: 1, on: false },
    t: 0,
    probe: 1.3,
    probeMoved: false,
    env: new Float32Array(NX),
    sumMax: 0,
    ampLow: false,
    ampHigh: false,
    lockA: false,
  };

  const wave = (w, x, t) => w.amp * Math.sin(2 * Math.PI * w.f * ((w.dir * x) / V - t) + (w.phase * Math.PI) / 180);
  const sum = (x, t) => wave(S.A, x, t) + (S.B.on ? wave(S.B, x, t) : 0);

  // Envelope: max |A+B| at each x over a 4 s window. Used for beats, nodes and the challenge.
  let envTimer = 0;
  function computeEnvelope() {
    let max = 0;
    for (let i = 0; i < NX; i++) {
      const x = (i / (NX - 1)) * L;
      let m = 0;
      for (let k = 0; k < NT; k++) {
        const t = S.t + (k / NT) * 4;
        const y = Math.abs(sum(x, t));
        if (y > m) m = y;
      }
      S.env[i] = m;
      if (m > max) max = m;
    }
    S.sumMax = max;
  }
  computeEnvelope();

  // ---------- geometry ----------
  function geo() {
    const padL = 64;
    const padR = 16;
    const stripH = size.h / 3;
    return {
      padL,
      stripH,
      sx: (x) => padL + (x / L) * (size.w - padL - padR),
      xAt: (px) => ((px - padL) / (size.w - padL - padR)) * L,
      base: (i) => stripH * i + stripH / 2,
      amp: stripH * 0.36,
    };
  }

  // ---------- pointer ----------
  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    moveProbe(e);
  });
  canvas.addEventListener('pointermove', (e) => dragging && moveProbe(e));
  canvas.addEventListener('pointerup', () => (dragging = false));
  canvas.addEventListener('pointercancel', () => (dragging = false));
  function moveProbe(e) {
    const p = pointerPos(canvas, e);
    S.probe = clamp(geo().xAt(p.x), 0, L);
    S.probeMoved = true;
  }

  // ---------- panel ----------
  const lessonBox = el('div');
  const aAmp = slider({ label: 'Amplitude', min: 0, max: 1, step: 0.05, value: S.A.amp, format: (v) => v.toFixed(2), onInput: (v) => (S.A.amp = v) });
  const aFreq = slider({ label: 'Frequency', min: 0.5, max: 3, step: 0.1, value: S.A.f, unit: ' Hz', format: (v) => v.toFixed(1), onInput: (v) => (S.A.f = v) });
  const bOn = toggle({ label: 'Wave B on', checked: S.B.on, onChange: (v) => (S.B.on = v) });
  const bAmp = slider({ label: 'Amplitude', min: 0, max: 1, step: 0.05, value: S.B.amp, format: (v) => v.toFixed(2), onInput: (v) => (S.B.amp = v) });
  const bFreq = slider({ label: 'Frequency', min: 0.5, max: 3, step: 0.1, value: S.B.f, unit: ' Hz', format: (v) => v.toFixed(1), onInput: (v) => (S.B.f = v) });
  const bPhase = slider({ label: 'Phase shift', min: 0, max: 360, step: 5, value: S.B.phase, unit: '°', onInput: (v) => (S.B.phase = v) });
  const bDir = segmented({
    label: 'Direction',
    options: [
      { label: '→ right', value: 1 },
      { label: '← left', value: -1 },
    ],
    value: S.B.dir,
    onChange: (v) => (S.B.dir = v),
  });
  const groupA = el('div', { class: 'ctl-group', style: `--g:${C.a}` }, el('div', { class: 'ctl-group-title' }, 'Wave A'), aAmp.el, aFreq.el);
  const groupB = el('div', { class: 'ctl-group', style: `--g:${C.b}` }, el('div', { class: 'ctl-group-title' }, 'Wave B'), bOn.el, bAmp.el, bFreq.el, bPhase.el, bDir.el);
  const controls = el('div', { class: 'controls' }, groupA, groupB);
  const ro = readouts([
    { key: 'lamA', label: 'Wavelength A', unit: 'm', digits: 2, color: C.a },
    { key: 'lamB', label: 'Wavelength B', unit: 'm', digits: 2, color: C.b },
    { key: 'beat', label: 'Beat frequency', unit: 'Hz', digits: 1 },
    { key: 'sumMax', label: 'Max of A + B', digits: 2, color: C.sum },
  ]);
  panel.append(lessonBox, controls, ro.el);

  function setA(amp, f, phase = 0) {
    S.A.phase = phase;
    aAmp.set(amp);
    aFreq.set(f);
  }
  function setB(on, amp, f, phase, dir) {
    bOn.set(on);
    bAmp.set(amp);
    bFreq.set(f);
    bPhase.set(phase);
    bDir.set(dir);
  }
  function lockA(locked) {
    S.lockA = locked;
    aAmp.lock(locked);
    aFreq.lock(locked);
  }
  const sameFreq = () => Math.abs(S.A.f - S.B.f) < 0.01;
  const sameAmp = () => Math.abs(S.A.amp - S.B.amp) < 0.03;

  // ---------- lesson ----------
  const lesson = createLesson({
    container: lessonBox,
    onRestart: () => {
      lockA(false);
      setA(0.8, 1);
      setB(false, 0.8, 1, 0, 1);
      S.probeMoved = false;
    },
    steps: [
      {
        title: 'Meet the wave',
        body: 'A wave is a wiggle that travels. Two numbers describe it: <b>frequency</b> (how many wiggles per second, in Hz) and <b>wavelength</b> (the distance from one crest to the next). This wave travels at a fixed 2 m/s.',
        setup() {
          lockA(false);
          setA(0.8, 1);
          setB(false, 0.8, 1, 0, 1);
        },
        predict: {
          question: 'If you raise the frequency, the wavelength will…',
          options: ['Get longer', 'Stay the same', 'Get shorter'],
          answer: 2,
          explain: 'The speed is fixed by the string, so more wiggles per second must fit into the same distance. v = f·λ, so a bigger f means a smaller λ.',
        },
        goal: 'Raise Wave A’s frequency to <b>2 Hz</b> or more and watch the crests bunch up.',
        check: () => S.A.f >= 2,
        done: () => `At ${fmt(S.A.f, 1)} Hz the wavelength is ${fmt(V / S.A.f, 2)} m. Frequency up, wavelength down, because <b>v = f · λ</b> and v is fixed. In sound, higher frequency means higher pitch.`,
      },
      {
        title: 'Turn it up',
        body: '<b>Amplitude</b> is the height of the wave: how much energy it carries. For sound that is loudness; for light, brightness.',
        setup() {
          S.ampLow = false;
          S.ampHigh = false;
        },
        tasks: [
          { label: 'Drop Wave A’s amplitude to <b>0.30</b> or lower.', check: () => S.A.amp <= 0.3 },
          { label: 'Now raise it to <b>0.90</b> or higher.', check: () => S.A.amp >= 0.9 },
        ],
        done: 'Notice the wavelength never changed while you did that. <b>Loudness and pitch are independent knobs</b>: you can whisper a high note or shout a low one.',
      },
      {
        title: 'Add a second wave',
        body: 'Two waves in the same place do not bounce off each other. They <b>add</b>. The bottom strip shows A + B at every point. Drag the probe line and watch the sum being built from the two parts.',
        setup() {
          setB(true, S.A.amp, S.A.f, 0, 1);
          S.probeMoved = false;
        },
        predict: {
          question: 'Two identical waves, perfectly in step. The combined wave will be…',
          options: ['The same height as one', 'Twice as tall', 'Flat'],
          answer: 1,
          explain: 'Crest meets crest and trough meets trough, so every point doubles. This is constructive interference.',
        },
        goal: 'Move the probe (drag on the waves) with both waves identical and in step.',
        check: () => S.probeMoved && S.B.on && sameFreq() && sameAmp() && S.B.phase % 360 === 0 && S.B.dir === 1,
        done: 'Twice as tall. Crest meets crest: <b>constructive interference</b>. That is why two speakers playing the same note in sync sound louder together.',
      },
      {
        title: 'Cancel it out',
        body: 'What if Wave B is shifted so its crests line up with Wave A’s troughs? Use the <b>phase shift</b> slider.',
        goal: 'Make the combined wave flat: shift Wave B’s phase until “Max of A + B” drops below 0.08.',
        hint: 'Half a cycle is 180°. Keep amplitude and frequency the same as Wave A.',
        check: () => S.B.on && S.sumMax < 0.08 && S.A.amp > 0.2,
        done: 'Silence. Crest meets trough: <b>destructive interference</b>. Noise-cancelling headphones do exactly this: they play an inverted copy of the noise into your ear.',
      },
      {
        title: 'Beats',
        body: 'Now make the two frequencies slightly different. The waves drift in and out of step, so the sum swells and fades: <b>beats</b>.',
        setup() {
          bPhase.set(0);
          bAmp.set(S.A.amp);
        },
        goal: 'Set Wave B’s frequency between 0.2 and 0.5 Hz away from Wave A’s.',
        check: () => S.B.on && Math.abs(S.A.f - S.B.f) >= 0.15 && Math.abs(S.A.f - S.B.f) <= 0.55,
        done: () => `The loudness pulses at the <b>beat frequency</b> = |f<sub>A</sub> − f<sub>B</sub>| = ${fmt(Math.abs(S.A.f - S.B.f), 1)} Hz. Musicians tune by adjusting until the beats disappear.`,
      },
      {
        title: 'Standing waves',
        body: 'Send Wave B the other way, as if Wave A reflected off a wall. Some points on the string will stop moving entirely.',
        setup() {
          bFreq.set(S.A.f);
          bAmp.set(S.A.amp);
          bPhase.set(0);
        },
        goal: 'Flip Wave B’s direction to <b>← left</b> with the same frequency and amplitude as A.',
        check: () => S.B.on && S.B.dir === -1 && sameFreq() && sameAmp(),
        done: 'The pattern no longer travels. The still points are <b>nodes</b>, the big swings are <b>antinodes</b>. Guitar strings, flutes and microwave ovens all work with standing waves.',
      },
      {
        title: 'Challenge: silence the noise',
        body: 'A noisy Wave A is playing and its knobs are locked. Tune Wave B to cancel it completely. You will need the right frequency, the right amplitude and the right phase shift.',
        setup() {
          const amp = Math.round((0.4 + Math.random() * 0.6) * 20) / 20;
          const f = Math.round((0.7 + Math.random() * 1.8) * 10) / 10;
          const phase = Math.floor(Math.random() * 72) * 5;
          setA(amp, f, phase);
          lockA(true);
          setB(true, 0.5, 1, 0, 1);
        },
        goal: 'Get “Max of A + B” below <b>0.05</b>.',
        hint: 'Match frequency first (the beats disappear). Then match amplitude. Then slide the phase until the sum flattens: it will be exactly half a cycle away from Wave A.',
        check: () => S.B.on && S.B.dir === 1 && S.sumMax < 0.05,
        done: '🔇 <b>Perfect cancellation.</b> Same frequency, same amplitude, half a cycle apart. You just designed a noise-cancelling headphone.',
      },
      {
        summary: true,
        title: 'You understand wave superposition',
        body: `
          <ul class="takeaways">
            <li><b>v = f · λ</b>: with speed fixed, higher frequency means shorter wavelength.</li>
            <li><b>Amplitude</b> is energy (loudness). It is independent of frequency (pitch).</li>
            <li>Overlapping waves <b>add point by point</b>: in step they double, half a cycle apart they cancel.</li>
            <li>Slightly different frequencies make <b>beats</b>; opposite directions make <b>standing waves</b>.</li>
          </ul>
          <div class="formulas">
            <span>v = f λ</span>
            <span>f<sub>beat</sub> = |f₁ − f₂|</span>
            <span>y = A sin(kx − ωt + φ)</span>
          </div>`,
      },
    ],
  });

  // ---------- drawing ----------
  function strip(i, label, color, fn, opts = {}) {
    const g = geo();
    const base = g.base(i);
    const top = g.stripH * i;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0)';
    ctx.fillRect(0, top, size.w, g.stripH);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(size.w, top);
    ctx.stroke();
    dashedLine(ctx, g.padL, base, size.w, base, 'rgba(255,255,255,0.18)', [4, 6]);
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = opts.muted ? 'rgba(255,255,255,0.3)' : color;
    ctx.fillText(label, 12, base);

    if (opts.envelope) {
      ctx.beginPath();
      for (let k = 0; k < NX; k++) ctx.lineTo(g.sx((k / (NX - 1)) * L), base - S.env[k] * g.amp);
      for (let k = NX - 1; k >= 0; k--) ctx.lineTo(g.sx((k / (NX - 1)) * L), base + S.env[k] * g.amp);
      ctx.closePath();
      ctx.fillStyle = C.env;
      ctx.fill();
    }

    ctx.save();
    ctx.strokeStyle = opts.muted ? 'rgba(255,255,255,0.15)' : color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const n = 240;
    for (let k = 0; k <= n; k++) {
      const x = (k / n) * L;
      const px = g.sx(x);
      const py = base - fn(x) * g.amp;
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    return { base };
  }

  function draw() {
    begin();
    const g = geo();
    const { w, h } = size;
    ctx.fillStyle = '#0d142b';
    ctx.fillRect(0, 0, w, h);

    const t = S.t;
    const fA = (x) => wave(S.A, x, t);
    const fB = (x) => (S.B.on ? wave(S.B, x, t) : 0);
    const fS = (x) => fA(x) + fB(x);
    const sA = strip(0, 'Wave A', C.a, fA);
    const sB = strip(1, S.B.on ? 'Wave B' : 'Wave B (off)', C.b, fB, { muted: !S.B.on });
    const sS = strip(2, 'A + B', C.sum, fS, { envelope: S.B.on });

    // nodes for standing waves
    if (S.B.on && S.B.dir !== S.A.dir && sameFreq()) {
      for (let k = 1; k < NX - 1; k++) {
        if (S.env[k] <= S.env[k - 1] && S.env[k] < S.env[k + 1] && S.env[k] < 0.12 * S.sumMax + 0.01) {
          const px = g.sx((k / (NX - 1)) * L);
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(px, sS.base, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = '600 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('node', px, sS.base + g.amp + 16);
        }
      }
    }

    // probe
    const px = g.sx(S.probe);
    const yA = fA(S.probe);
    const yB = fB(S.probe);
    dashedLine(ctx, px, 0, px, h, 'rgba(255,255,255,0.35)', [3, 4]);
    const dot = (y, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, y, 5, 0, Math.PI * 2);
      ctx.fill();
    };
    dot(sA.base - yA * g.amp, C.a);
    if (S.B.on) dot(sB.base - yB * g.amp, C.b);
    // stacked contributions on the sum strip
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.a;
    ctx.beginPath();
    ctx.moveTo(px, sS.base);
    ctx.lineTo(px, sS.base - yA * g.amp);
    ctx.stroke();
    if (S.B.on) {
      ctx.strokeStyle = C.b;
      ctx.beginPath();
      ctx.moveTo(px, sS.base - yA * g.amp);
      ctx.lineTo(px, sS.base - (yA + yB) * g.amp);
      ctx.stroke();
    }
    dot(sS.base - (yA + yB) * g.amp, C.sum);
    const sign = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
    pill(ctx, `A ${sign(yA)}`, w - 12, g.base(0) - g.stripH * 0.36, { align: 'right', color: C.a, font: '600 11px Inter, system-ui, sans-serif' });
    if (S.B.on) pill(ctx, `B ${sign(yB)}`, w - 12, g.base(1) - g.stripH * 0.36, { align: 'right', color: C.b, font: '600 11px Inter, system-ui, sans-serif' });
    pill(ctx, `A + B ${sign(yA + yB)}`, w - 12, g.base(2) - g.stripH * 0.36, { align: 'right', color: C.sum, font: '600 11px Inter, system-ui, sans-serif' });

    // wavelength ruler on wave A
    const lam = V / S.A.f;
    const x0 = 0.3;
    if (x0 + lam <= L) {
      const y = g.base(0) + g.stripH * 0.43;
      const rx1 = g.sx(x0);
      const rx2 = g.sx(x0 + lam);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx1, y);
      ctx.lineTo(rx2, y);
      ctx.moveTo(rx1, y - 4);
      ctx.lineTo(rx1, y + 4);
      ctx.moveTo(rx2, y - 4);
      ctx.lineTo(rx2, y + 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '600 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`λ = ${fmt(lam, 2)} m`, rx2 + 8, y);
    }
  }

  startLoop(canvas, (dt) => {
    S.t += dt;
    envTimer += dt;
    if (envTimer > 0.2) {
      envTimer = 0;
      computeEnvelope();
    }
    draw();
    ro.update({
      lamA: V / S.A.f,
      lamB: S.B.on ? V / S.B.f : null,
      beat: S.B.on ? Math.abs(S.A.f - S.B.f) : null,
      sumMax: S.sumMax,
    });
    hint.classList.toggle('is-hidden', S.probeMoved);
    lesson.update();
  });
}
