// Tiny DOM helpers and the control widgets used in every lab panel.

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function slider({ label, min, max, step, value, unit = '', format = (v) => v, onInput }) {
  const input = el('input', { type: 'range', min, max, step, value, 'aria-label': label });
  const out = el('span', { class: 'ctl-value' });
  const wrap = el('label', { class: 'ctl ctl-slider' }, el('span', { class: 'ctl-label' }, label), out, input);

  const show = () => {
    const v = +input.value;
    out.textContent = `${format(v)}${unit}`;
    wrap.style.setProperty('--p', `${((v - min) / (max - min)) * 100}%`);
  };
  input.addEventListener('input', () => {
    show();
    onInput?.(+input.value);
  });
  show();

  return {
    el: wrap,
    get value() {
      return +input.value;
    },
    set(v, silent = false) {
      input.value = v;
      show();
      if (!silent) onInput?.(+input.value);
    },
    lock(locked) {
      input.disabled = locked;
      wrap.classList.toggle('is-locked', locked);
    },
  };
}

export function toggle({ label, checked = false, onChange }) {
  const input = el('input', { type: 'checkbox', checked, role: 'switch' });
  const wrap = el(
    'label',
    { class: 'ctl ctl-toggle' },
    input,
    el('span', { class: 'ctl-switch', 'aria-hidden': 'true' }),
    el('span', { class: 'ctl-label' }, label),
  );
  input.addEventListener('change', () => onChange?.(input.checked));
  return {
    el: wrap,
    get value() {
      return input.checked;
    },
    set(v, silent = false) {
      input.checked = v;
      if (!silent) onChange?.(v);
    },
    lock(locked) {
      input.disabled = locked;
      wrap.classList.toggle('is-locked', locked);
    },
  };
}

// A two-or-more way switch, e.g. wave direction.
export function segmented({ label, options, value, onChange }) {
  let current = value;
  const buttons = options.map((o) =>
    el(
      'button',
      {
        type: 'button',
        class: 'seg-btn',
        'aria-pressed': String(o.value === current),
        onClick: () => {
          if (current === o.value) return;
          current = o.value;
          paint();
          onChange?.(current);
        },
      },
      o.label,
    ),
  );
  const group = el('div', { class: 'seg', role: 'group', 'aria-label': label }, buttons);
  const wrap = el('div', { class: 'ctl ctl-seg' }, el('span', { class: 'ctl-label' }, label), group);
  function paint() {
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === current)));
  }
  return {
    el: wrap,
    get value() {
      return current;
    },
    set(v, silent = false) {
      current = v;
      paint();
      if (!silent) onChange?.(v);
    },
    lock(locked) {
      buttons.forEach((b) => (b.disabled = locked));
      wrap.classList.toggle('is-locked', locked);
    },
  };
}

export function button(label, onClick, cls = 'btn') {
  return el('button', { class: cls, type: 'button', onClick }, label);
}

// A grid of live numeric readouts.
export function readouts(defs) {
  const cells = {};
  const grid = el(
    'div',
    { class: 'readouts' },
    defs.map((d) => {
      const v = el('span', { class: 'ro-value' }, '–');
      cells[d.key] = { v, d };
      return el('div', { class: 'ro', style: d.color ? `--ro:${d.color}` : null }, el('span', { class: 'ro-label' }, d.label), v);
    }),
  );
  return {
    el: grid,
    update(values) {
      for (const [k, val] of Object.entries(values)) {
        const c = cells[k];
        if (!c) continue;
        if (val == null || Number.isNaN(val)) {
          c.v.textContent = '–';
          continue;
        }
        const num = typeof val === 'number' ? val.toFixed(c.d.digits ?? 1) : String(val);
        c.v.textContent = c.d.unit ? `${num} ${c.d.unit}` : num;
      }
    },
  };
}
