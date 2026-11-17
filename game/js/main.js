// main.js — THE LAST GLAZIER's bootstrap: canvas, pointer + keyboard
// input, the two artisan gestures (FIT a shard, SEAL a circuit by tracing
// its golden seam), the darkness clock, the screen flow
// (title → playing → tally/dawn/night), and the ?stage= staging hooks the
// screenshots are taken with. Staged scenes are assembled from the game's
// real state and rendered by the real renderer; nothing is drawn by hand
// for the camera.

import {
  createGameState, loadWindow, startRun, placeShard, sealCircuit,
  angleFits, addFloater, windowComplete, mulberry32,
} from './state.js';
import { drawGame } from './render.js';
import {
  unlockAudio, setMuted, isMuted, sfxFit, sfxPerfect, sfxCrack,
  sfxSeal, sfxBell, sfxDawn, sfxClick, setSizzle,
} from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const state = createGameState();
loadWindow(state, 0);
seedMotes(state);

// ------------------------------------------------------------ helpers

function seedMotes(s) {
  const rng = mulberry32(1900 + s.winIndex * 331);
  s.motes = [];
  for (let i = 0; i < 44; i++) {
    s.motes.push({
      x: 150 + rng() * 520, y: 140 + rng() * 500,
      r: 0.8 + rng() * 1.5, phase: rng() * Math.PI * 2, drift: 4 + rng() * 8,
    });
  }
}

function toGameCoords(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left) * (canvas.width / rect.width),
    y: (evt.clientY - rect.top) * (canvas.height / rect.height),
  };
}

const dist = (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0);

function shardAt(x, y) {
  const shards = state.win.shards;
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    if (s.placed) continue;
    if (dist(x, y, s.x, s.y) <= s.maxR * s.scale + 5) return s;
  }
  return null;
}

function readyCircuitAt(x, y) {
  for (const c of state.win.circuits) {
    if (!c.ready || c.sealed) continue;
    for (const s of c.samples) if (dist(x, y, s.x, s.y) <= 30) return c;
  }
  return null;
}

// ------------------------------------------------------------ the gestures

function rotateShard(shard, deg) {
  if (!shard || shard.placed) return;
  shard.rotation = ((shard.rotation + deg) % 360 + 360) % 360;
}

function dropShard(shard) {
  let best = null, bestD = 76;
  for (const slot of state.win.slots.values()) {
    if (slot.placed) continue;
    const d = dist(shard.x, shard.y, slot.c[0], slot.c[1]);
    if (d < bestD) { bestD = d; best = slot; }
  }
  if (best && shard.slotId === best.id && angleFits(shard, best)) {
    const perfect = shard.attempts === 0;
    placeShard(state, shard);
    if (perfect) {
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.win.stats.perfects += 1;
      state.totalPerfects += 1;
      state.score += 150;
      addFloater(state, best.c[0], best.c[1] - 14, 'PERFECT FIT +150', { size: 21, color: '#ffd76a' });
      if (state.streak >= 2) {
        addFloater(state, best.c[0], best.c[1] - 40, `STREAK ×${state.streak}`, { size: 16, color: '#ffe9b0' });
      }
      sfxPerfect(state.streak);
    } else {
      state.score += 100;
      addFloater(state, best.c[0], best.c[1] - 14, '+100', { size: 17, color: '#ffe9b0' });
      sfxFit(state.streak);
    }
    return;
  }
  // A miss only hurts if the shard was actually offered to the window;
  // setting it back down on the bench is free.
  const def = state.win.def;
  const overWindow = def.kind === 'rose'
    ? dist(shard.x, shard.y, def.cx, def.cy) < def.frameR + 52
    : Math.abs(shard.x - def.cx) < 210 && Math.abs(shard.y - def.cy) < 264;
  if (overWindow || best) {
    shard.attempts += 1;
    state.streak = 0;
    state.darkness = Math.min(100, state.darkness + 4);
    addFloater(state, shard.x, shard.y - 18, 'CRACK!', { size: 16, color: '#ff9a86' });
    sfxCrack();
  }
  shard.x = shard.homeX;
  shard.y = shard.homeY;
}

function traceStep() {
  const c = state.tracing;
  if (!c) return;
  const { x, y } = state.pointer;
  let marked = false;
  for (const s of c.samples) {
    if (!s.done && dist(x, y, s.x, s.y) <= 25) {
      s.done = true;
      c.doneOrder.push(s);
      marked = true;
    }
  }
  if (marked) c.lastMark = state.time;
  state.solderTip = { x, y };
  setSizzle(true);
  if (c.doneOrder.length >= c.samples.length * 0.985) {
    state.tracing = null;
    state.solderTip = null;
    setSizzle(false);
    sealCircuit(state, c);
    sfxSeal();
    if (windowComplete(state)) state.completing = 1.5;
  }
}

// ------------------------------------------------------------ screens

function enterTally() {
  const stats = state.win.stats;
  const bonus = Math.round(100 - state.darkness) * 10;
  state.score += bonus;
  const row = {
    name: state.win.def.name,
    fits: stats.fits, perfects: stats.perfects, seals: stats.seals,
    bonus, subtotal: state.score - stats.scoreAtStart,
  };
  state.runStats.push(row);
  state.tally = row;
  state.screen = state.winIndex === state.windows.length - 1 ? 'dawn' : 'tally';
  sfxDawn();
}

function nextWindow() {
  loadWindow(state, state.winIndex + 1);
  seedMotes(state);
  state.screen = 'playing';
  sfxClick();
}

function handleButton(id) {
  if (id === 'start') { startRun(state); seedMotes(state); sfxClick(); }
  else if (id === 'next') nextWindow();
  else if (id === 'again') { startRun(state); seedMotes(state); sfxClick(); }
  else if (id === 'mute') {
    state.muted = !state.muted;
    setMuted(state.muted);
  }
}

// ------------------------------------------------------------ input

canvas.addEventListener('pointerdown', (evt) => {
  unlockAudio();
  const p = toGameCoords(evt);
  state.pointer.x = p.x; state.pointer.y = p.y; state.pointer.down = true;
  if (evt.button === 2) { // right-click rotates the held or hovered shard
    rotateShard(state.drag?.shard ?? state.hoverShard, 45);
    return;
  }
  if (evt.button !== 0) return;
  const button = state.buttons.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
  if (button) { handleButton(button.id); return; }
  if (state.screen !== 'playing') return;
  const circuit = readyCircuitAt(p.x, p.y);
  if (circuit) {
    state.tracing = circuit;
    traceStep();
    return;
  }
  const shard = shardAt(p.x, p.y);
  if (shard) state.drag = { shard, dx: shard.x - p.x, dy: shard.y - p.y };
});

window.addEventListener('pointermove', (evt) => {
  const p = toGameCoords(evt);
  state.pointer.x = p.x; state.pointer.y = p.y;
  if (state.drag) {
    state.drag.shard.x = p.x + state.drag.dx;
    state.drag.shard.y = p.y + state.drag.dy;
  } else if (state.tracing && state.pointer.down) {
    traceStep();
  } else if (state.screen === 'playing') {
    state.hoverShard = shardAt(p.x, p.y);
  }
});

window.addEventListener('pointerup', () => {
  state.pointer.down = false;
  if (state.drag) {
    dropShard(state.drag.shard);
    state.drag = null;
  }
  if (state.tracing) {
    state.tracing = null;
    state.solderTip = null;
    setSizzle(false);
  }
});

canvas.addEventListener('wheel', (evt) => {
  evt.preventDefault();
  const shard = state.drag?.shard ?? state.hoverShard;
  rotateShard(shard, evt.deltaY > 0 ? 15 : -15);
}, { passive: false });

canvas.addEventListener('contextmenu', (evt) => evt.preventDefault());

window.addEventListener('keydown', (evt) => {
  const key = evt.key.toLowerCase();
  unlockAudio();
  if (key === 'm') { handleButton('mute'); return; }
  if (state.screen === 'playing') {
    if (key === 'q') rotateShard(state.drag?.shard ?? state.hoverShard, -15);
    else if (key === 'e') rotateShard(state.drag?.shard ?? state.hoverShard, 15);
  } else if (state.screen === 'title' && (key === 'enter' || key === ' ')) handleButton('start');
  else if ((state.screen === 'dawn' || state.screen === 'night') && key === 'r') handleButton('again');
  else if (state.screen === 'tally' && key === 'enter') handleButton('next');
});

// ------------------------------------------------------------ update

function update(dt) {
  const win = state.win;
  // deal-in + lift scaling for shards
  win.dealT = (win.dealT ?? 0) + dt;
  win.shards.forEach((shard, i) => {
    const target = shard.placed || state.drag?.shard === shard ? 1 : shard.trayScale;
    const goal = win.dealT < i * 0.04 ? 0 : target;
    shard.scale += (goal - shard.scale) * Math.min(1, dt * 11);
    if (Math.abs(goal - shard.scale) < 0.003) shard.scale = goal;
  });
  // dust motes drifting through the light
  for (const m of state.motes) {
    m.y += m.drift * dt;
    m.x += Math.sin(state.time * 0.4 + m.phase) * 3.2 * dt;
    if (m.y > 668) { m.y = 138; m.x = 150 + ((m.x * 7) % 520); }
  }
  // floaters and ignitions
  for (const f of state.floaters) { f.life -= dt; f.y += f.vy * dt; }
  state.floaters = state.floaters.filter((f) => f.life > 0);
  for (const ig of state.ignitions) ig.t += dt / 1.15;
  state.ignitions = state.ignitions.filter((ig) => ig.t < 1);
  // an untended seam cools: the newest solder un-runs first
  for (const c of win.circuits) {
    if (!c.ready || c.sealed || state.tracing === c || c.doneOrder.length === 0) continue;
    if (state.time - c.lastMark < 1.0) continue;
    c.coolCarry = (c.coolCarry ?? 0) + dt * c.samples.length * 0.055;
    while (c.coolCarry >= 1 && c.doneOrder.length > 0) {
      c.coolCarry -= 1;
      c.doneOrder.pop().done = false;
    }
  }
  if (state.screen !== 'playing') return;
  if (state.completing) {
    state.completing -= dt;
    if (state.completing <= 0) { state.completing = 0; enterTally(); }
    return;
  }
  // the darkness clock
  state.darkness += win.def.darknessRate * dt;
  if (state.darkness >= 70 && !state.bells.b70) {
    state.bells.b70 = true;
    sfxBell();
    addFloater(state, 640, 128, 'THE BELL TOLLS — NIGHT NEARS', { size: 19, color: '#c9a8ff', life: 1.8 });
  }
  if (state.darkness >= 90 && !state.bells.b90) {
    state.bells.b90 = true;
    sfxBell();
    addFloater(state, 640, 128, 'THE FINAL BELL IS NEAR', { size: 19, color: '#ff9a86', life: 1.8 });
  }
  if (state.darkness >= 100) {
    state.darkness = 100;
    state.screen = 'night';
    state.drag = null;
    state.tracing = null;
    state.solderTip = null;
    setSizzle(false);
    sfxBell();
  }
}

// ------------------------------------------------------------ the loop

let last = performance.now();
let frames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (!state.staged) {
    state.time += dt;
    update(dt);
  }
  drawGame(ctx, state);
  frames += 1;
  if (state.staged && frames >= 3) window.__shotReady = true;
}

// ------------------------------------------------------------ staging
// ?stage=cover · title · dawn · night. Each scene is assembled from the
// game's real entities (placeShard / sealCircuit do the placing and
// sealing) and then frozen; the camera only ever sees the real renderer.

function stageCover() {
  startRun(state);
  loadWindow(state, 1); // Window II · The Great Rose
  seedMotes(state);
  const win = state.win;
  const shardOf = (slotId) => win.shards.find((s) => s.slotId === slotId);
  const outer = win.circuits.find((c) => c.id === 'c2');
  const middle = win.circuits.find((c) => c.id === 'c1');
  const medallion = win.circuits.find((c) => c.id === 'c0');
  // (a) the OUTER ring: every pane fitted and the circuit already SEALED —
  // luminous glass throwing its pools on the floor. Its seal (+2,400 at
  // streak ×2) is the popup still fading over the window.
  for (let i = 0; i < 12; i++) placeShard(state, shardOf(`c2s${i}`), { silent: true });
  state.streak = 2;
  sealCircuit(state, outer, { silent: true }); // 12 panes × 100 × streak 2 = +2,400
  // (b) the MIDDLE ring: only HALF fitted — its lower six panes are in the
  // glass; the upper six lie on the workbench in their tray cells, their
  // slots ghosting dark across the top of the window.
  for (let i = 0; i < 6; i++) placeShard(state, shardOf(`c1s${i}`), { silent: true });
  // (c) the MEDALLION: fitted, its circuit whole, and ON THE IRON NOW —
  // the golden trail runs 60% of its little seam (24 of its 40 samples)
  // and the tip still glows where the hand paused.
  placeShard(state, shardOf('medallion'), { silent: true });
  const upto = Math.round(medallion.samples.length * 0.60);
  for (let i = 0; i < upto; i++) {
    medallion.samples[i].done = true;
    medallion.doneOrder.push(medallion.samples[i]);
  }
  medallion.lastMark = 0;
  state.tracing = medallion;
  const tip = medallion.samples[upto - 1];
  state.solderTip = { x: tip.x, y: tip.y };
  state.pointer = { x: tip.x, y: tip.y, down: true };
  // (Staged scenes skip update(), so deal the bench shards in by hand.)
  for (const s of win.shards) if (!s.placed) s.scale = s.trayScale;
  // the numbers the HUD and popups tell: Window I banked 3,530; the outer
  // ring's fits (7 perfect, 5 plain) 1,550 and its seal 2,400; the middle
  // ring's six fits (3 perfect, 3 plain) 750 — the last of them perfect;
  // the medallion's first-try fit 150, a perfect that lifted the streak
  // to ×6 just before the iron touched its seam.
  state.score = 8380;
  state.streak = 6;
  state.bestStreak = 6;
  state.totalFits = 28;
  state.totalPerfects = 18;
  state.totalSeals = 3;
  state.darkness = 69.36; // the bell clock reads FINAL BELL 1:12
  state.time = 1.7;
  addFloater(state, 402, 252, 'CIRCUIT SEALED! +2,400', { size: 33, color: '#ffd76a', life: 1.7 });
  state.floaters[state.floaters.length - 1].life = 0.45; // already fading
  const lastFit = win.slots.get('c1s5').c;
  addFloater(state, lastFit[0], lastFit[1] - 14, 'PERFECT FIT +150', { size: 19, color: '#ffd76a', life: 1.15 });
  state.staged = true;
}

function stageDawn() {
  startRun(state);
  loadWindow(state, 2); // Window III, fully restored, as the backdrop
  seedMotes(state);
  const win = state.win;
  for (const shard of [...win.shards]) {
    if (shard.slotId) placeShard(state, shard, { silent: true });
  }
  state.streak = 5;
  for (const c of win.circuits) sealCircuit(state, c, { silent: true });
  state.runStats = [
    { name: 'I · THE CHAPEL ROSE', fits: 9, perfects: 7, seals: 2, bonus: 640, subtotal: 2890 },
    { name: 'II · THE GREAT ROSE', fits: 25, perfects: 16, seals: 3, bonus: 410, subtotal: 7610 },
    { name: 'III · THE WEST WINDOW', fits: 16, perfects: 11, seals: 4, bonus: 380, subtotal: 5980 },
  ];
  state.score = 16480 + 1430;
  state.totalFits = 50;
  state.totalPerfects = 34;
  state.totalSeals = 9;
  state.bestStreak = 9;
  state.darkness = 24;
  state.time = 1.7;
  state.screen = 'dawn';
  state.staged = true;
}

function stageNight() {
  startRun(state);
  loadWindow(state, 1);
  seedMotes(state);
  const win = state.win;
  const shardOf = (slotId) => win.shards.find((s) => s.slotId === slotId);
  placeShard(state, shardOf('medallion'), { silent: true });
  for (let i = 0; i < 5; i++) placeShard(state, shardOf(`c1s${i}`), { silent: true });
  state.score = 4320;
  state.totalFits = 6;
  state.totalSeals = 0;
  state.darkness = 100;
  state.time = 1.7;
  state.screen = 'night';
  state.staged = true;
}

const stageParam = new URLSearchParams(window.location.search).get('stage');
if (stageParam === 'cover') stageCover();
else if (stageParam === 'dawn') stageDawn();
else if (stageParam === 'night') stageNight();
else if (stageParam === 'title') { state.time = 1.7; state.staged = true; }

window.__glazier = { state };
requestAnimationFrame(frame);
