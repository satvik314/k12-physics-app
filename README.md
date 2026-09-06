# Orbit — k12 physics app

Interactive physics labs for grades 8–12. A landing page with three playable,
self-guided labs built in plain JavaScript on Vite:

| Lab | Concept | What the student does |
| --- | --- | --- |
| 01 Projectile Motion | Kinematics under gravity | Aim a cannon, watch velocity split into components, freeze the ball at its apex, run the angle experiment, hit a target |
| 02 Conservation of Energy | PE ↔ KE, friction → heat | Drop a skater into a half-pipe, predict her return height, clear a hill, add friction, pick a height for a target speed |
| 03 Waves & Superposition | v = fλ, interference, beats, standing waves | Tune two waves, add them point by point, cancel them, make beats and nodes, then "silence the noise" |

Each lab follows the same **Predict → Play → Prove** loop: a prediction question,
live tasks that are checked against the simulation state, an explanation once the
task passes, and a final challenge before the formulas are revealed.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the production build
```

## Layout

```
index.html            landing page markup
src/main.js           mounts the labs, hero animation, scroll reveal
src/style.css         design system + lab layout
src/lib/canvas.js     HiDPI canvas, animation loop, drawing helpers
src/lib/ui.js         sliders, toggles, buttons, readouts
src/lib/lesson.js     the step-by-step lesson engine
src/labs/*.js         one file per lab (simulation + drawing + lesson script)
```

No frameworks, no runtime dependencies.
