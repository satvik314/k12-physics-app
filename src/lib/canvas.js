// Small canvas helpers shared by all labs: HiDPI setup, a visibility-gated
// animation loop, pointer mapping, and a few drawing primitives.

export function setupCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const size = { w: 0, h: 0, dpr: 1 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size.w = rect.width;
    size.h = rect.height;
    size.dpr = dpr;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }

  new ResizeObserver(resize).observe(canvas);
  resize();

  return {
    ctx,
    size,
    begin() {
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);
    },
  };
}

// Runs `tick(dt, t)` every frame while `element` is on screen.
export function startLoop(element, tick) {
  let visible = false;
  let last = 0;
  let raf = 0;

  function frame(now) {
    if (!visible) {
      raf = 0;
      return;
    }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    tick(dt, now / 1000);
    raf = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    { rootMargin: '120px' },
  );
  io.observe(element);
}

export function pointerPos(canvas, ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function arrow(ctx, x1, y1, x2, y2, color, width = 3, head = 10) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len;
  const uy = dy / len;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - ux * head * 0.6, y2 - uy * head * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * head - uy * head * 0.5, y2 - uy * head + ux * head * 0.5);
  ctx.lineTo(x2 - ux * head + uy * head * 0.5, y2 - uy * head - ux * head * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// A rounded text pill, anchored by `align` at (x, y).
export function pill(ctx, text, x, y, opts = {}) {
  const {
    color = '#fff',
    bg = 'rgba(8, 12, 28, 0.78)',
    font = '600 12px Inter, system-ui, sans-serif',
    align = 'left',
    padX = 8,
    padY = 5,
    border = 'rgba(255,255,255,0.12)',
  } = opts;
  ctx.save();
  ctx.font = font;
  const tw = ctx.measureText(text).width;
  const w = tw + padX * 2;
  const h = 22;
  let left = x;
  if (align === 'center') left = x - w / 2;
  if (align === 'right') left = x - w;
  const top = y - h / 2;
  ctx.fillStyle = bg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + padX, y + 0.5);
  ctx.restore();
  return { left, top, w, h };
}

export function dashedLine(ctx, x1, y1, x2, y2, color, dash = [5, 5], width = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function fmt(v, digits = 1) {
  return Number(v).toFixed(digits);
}
