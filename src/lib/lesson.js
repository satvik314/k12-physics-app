// The guided-lesson engine. Every lab hands it an ordered list of steps:
//
//   {
//     title, body (html or () => html),
//     setup?: () => void            // runs when the step becomes active
//     predict?: { question, options: [], answer: index, explain }
//     goal?: html, check?: () => boolean          // single task, or
//     tasks?: [{ label, check }]                  // several tasks
//     done?: html | () => html      // shown once the task(s) pass
//     hint?: html
//     summary?: true                // final recap step
//   }
//
// The lab calls lesson.update() once per frame so checks run live.

import { el, button } from './ui.js';

export function createLesson({ container, steps, onRestart }) {
  const root = el('div', { class: 'lesson' });
  container.append(root);

  let i = 0;
  let passed = false;
  let choice = null;
  let hintOpen = false;
  let taskState = [];

  const html = (v) => (typeof v === 'function' ? v() : v);
  const tasksOf = (s) => s.tasks || (s.goal ? [{ label: s.goal, check: s.check }] : []);

  function enter(idx) {
    i = Math.min(idx, steps.length - 1);
    passed = false;
    choice = null;
    hintOpen = false;
    taskState = [];
    steps[i].setup?.();
    render();
  }

  function render() {
    const s = steps[i];
    const stepsWithTasks = steps.filter((x) => !x.summary).length;
    root.innerHTML = '';
    root.classList.toggle('is-passed', passed);

    root.append(
      el(
        'div',
        { class: 'lesson-top' },
        el('span', { class: 'lesson-count' }, s.summary ? 'Lab complete' : `Step ${i + 1} of ${stepsWithTasks}`),
        el(
          'div',
          { class: 'lesson-dots', 'aria-hidden': 'true' },
          steps.map((_, k) => el('span', { class: 'dot' + (k < i ? ' done' : k === i ? ' active' : '') })),
        ),
      ),
      el('h3', { class: 'lesson-title' }, s.title),
      el('div', { class: 'lesson-body', html: html(s.body) }),
    );

    if (s.summary) {
      root.append(
        el(
          'div',
          { class: 'lesson-actions' },
          button('Play again', () => {
            onRestart?.();
            enter(0);
          }, 'btn btn-primary'),
        ),
      );
      return;
    }

    if (s.predict) {
      const box = el('div', { class: 'predict' }, el('p', { class: 'predict-q' }, s.predict.question));
      box.append(
        el(
          'div',
          { class: 'predict-opts' },
          s.predict.options.map((o, k) => {
            let cls = 'chip';
            if (choice === k) cls += ' selected';
            if (passed && k === s.predict.answer) cls += ' correct';
            if (passed && choice === k && k !== s.predict.answer) cls += ' wrong';
            return el(
              'button',
              {
                type: 'button',
                class: cls,
                onClick: () => {
                  if (passed) return;
                  choice = k;
                  render();
                },
              },
              o,
            );
          }),
        ),
      );
      if (passed && choice != null) {
        const ok = choice === s.predict.answer;
        box.append(
          el('p', { class: 'predict-feedback' + (ok ? ' ok' : ''), html: (ok ? '<b>You called it.</b> ' : '<b>Not quite.</b> ') + (s.predict.explain || '') }),
        );
      } else if (choice == null) {
        box.append(el('p', { class: 'predict-note' }, 'Pick one before you experiment.'));
      }
      root.append(box);
    }

    const tasks = tasksOf(s);
    if (tasks.length) {
      root.append(
        el(
          'div',
          { class: 'tasks' + (s.predict && choice == null ? ' is-waiting' : '') },
          el('span', { class: 'tasks-title' }, 'Your task'),
          tasks.map((t, k) =>
            el(
              'div',
              { class: 'task' + (taskState[k] ? ' done' : '') },
              el('span', { class: 'task-check' }, taskState[k] ? '✓' : String(k + 1)),
              el('span', { html: html(t.label) }),
            ),
          ),
        ),
      );
    }

    if (passed && s.done) root.append(el('div', { class: 'lesson-done', html: html(s.done) }));
    if (s.hint && hintOpen) root.append(el('div', { class: 'lesson-hint', html: html(s.hint) }));

    const actions = el('div', { class: 'lesson-actions' });
    if (s.hint) {
      actions.append(
        button(hintOpen ? 'Hide hint' : 'Hint', () => {
          hintOpen = !hintOpen;
          render();
        }, 'btn btn-ghost'),
      );
    }
    actions.append(button(passed ? 'Next →' : 'Skip →', () => enter(i + 1), passed ? 'btn btn-primary' : 'btn btn-ghost btn-skip'));
    root.append(actions);
  }

  function update() {
    const s = steps[i];
    if (s.summary) return;
    const tasks = tasksOf(s);
    if (!tasks.length) return;
    if (s.predict && choice == null) return;
    let changed = false;
    tasks.forEach((t, k) => {
      if (taskState[k]) return;
      if (t.check && t.check()) {
        taskState[k] = true;
        changed = true;
      }
    });
    if (!passed && tasks.every((_, k) => taskState[k])) {
      passed = true;
      changed = true;
      s.onPass?.();
    }
    if (changed) render();
  }

  enter(0);
  return {
    update,
    restart: () => enter(0),
    get index() {
      return i;
    },
  };
}
