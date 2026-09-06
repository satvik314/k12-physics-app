import './style.css';
import { mountProjectileLab } from './labs/projectile.js';
import { mountEnergyLab } from './labs/energy.js';
import { mountWavesLab } from './labs/waves.js';
import { setupCanvas, startLoop } from './lib/canvas.js';

// ---------- labs ----------
mountProjectileLab(document.querySelector('[data-lab="projectile"]'));
mountEnergyLab(document.querySelector('[data-lab="energy"]'));
mountWavesLab(document.querySelector('[data-lab="waves"]'));

// ---------- scroll reveal ----------
const reveal = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        reveal.unobserve(e.target);
      }
    }
  },
  { threshold: 0.15 },
);
document.querySelectorAll('.reveal').forEach((n) => reveal.observe(n));

// ---------- nav shadow ----------
const nav = document.querySelector('.nav');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 12);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- signup (client-side only for now) ----------
const form = document.getElementById('signup');
const note = document.getElementById('signup-note');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    note.textContent = 'That email does not look right. Try again?';
    note.classList.add('is-error');
    return;
  }
  note.textContent = `Thanks! We’ll let ${email} know when the next lab is ready.`;
  note.classList.remove('is-error');
  note.classList.add('is-ok');
  form.reset();
});

// ---------- hero background: gravity orbits ----------
(function heroOrbits() {
  const canvas = document.getElementById('hero-bg');
  if (!canvas) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { ctx, size, begin } = setupCanvas(canvas);
  const bodies = Array.from({ length: 7 }, (_, i) => ({
    a: 0.22 + i * 0.09, // semi-major axis fraction of min(w,h)
    e: 0.15 + (i % 3) * 0.12,
    tilt: -0.5 + i * 0.35,
    phase: (i * 2.4) % (Math.PI * 2),
    speed: 0.9 / Math.pow(0.22 + i * 0.09, 1.5) * 0.06,
    r: 2.2 + (i % 3),
    color: ['#6ea8ff', '#b48cff', '#ffb84d', '#4ade80'][i % 4],
  }));
  let time = 0;
  function frame(dt) {
    if (!reduced) time += dt;
    begin();
    const { w, h } = size;
    const cx = w * 0.72;
    const cy = h * 0.45;
    const R = Math.min(w, h);
    ctx.save();
    ctx.globalAlpha = 0.9;
    bodies.forEach((b) => {
      const A = b.a * R;
      const B = A * Math.sqrt(1 - b.e * b.e);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(b.tilt);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(A * b.e, 0, A, B, 0, 0, Math.PI * 2);
      ctx.stroke();
      const th = b.phase + time * b.speed;
      const x = A * b.e + A * Math.cos(th);
      const y = B * Math.sin(th);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, b.r * 5);
      glow.addColorStop(0, b.color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(x, y, b.r * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(x, y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
    sun.addColorStop(0, 'rgba(255,184,77,0.9)');
    sun.addColorStop(0.2, 'rgba(255,184,77,0.35)');
    sun.addColorStop(1, 'rgba(255,184,77,0)');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  startLoop(canvas, frame);
})();
