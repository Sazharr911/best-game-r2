// render.js — every pixel of THE LAST GLAZIER. Warm craft materiality:
// jewel glass with seeded texture, dark lead cames, a stone chapel wall,
// dust motes in the light, and coloured pools on the floor wherever a
// circuit has been sealed. The HUD never leaves the frame during play:
// objective, shard/circuit counts, darkness, score and streak.

import { HUES, TRAY, centroid, mulberry32 } from './state.js';

const SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif';
const SANS = '"Segoe UI", system-ui, "DejaVu Sans", sans-serif';
const fmt = (n) => n.toLocaleString('en-US');

// ------------------------------------------------------------ textures

let wallCanvas = null;
const glassTextures = {}; // hue -> [3 canvases]

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function buildWall() {
  wallCanvas = makeCanvas(1280, 720);
  const g = wallCanvas.getContext('2d');
  const rng = mulberry32(4242);
  g.fillStyle = '#37281b';
  g.fillRect(0, 0, 1280, 720);
  // stone courses
  const rowH = 46;
  for (let row = 0; row * rowH < 720; row++) {
    const off = row % 2 ? 60 : 0;
    for (let x = -60; x < 1280; x += 120) {
      const shade = 0.92 + rng() * 0.16;
      g.fillStyle = `rgb(${Math.round(58 * shade)},${Math.round(43 * shade)},${Math.round(29 * shade)})`;
      g.fillRect(x + off + 2, row * rowH + 2, 116, rowH - 4);
    }
  }
  g.strokeStyle = 'rgba(12,8,5,0.55)';
  g.lineWidth = 3;
  for (let y = 0; y <= 720; y += rowH) { g.beginPath(); g.moveTo(0, y); g.lineTo(1280, y); g.stroke(); }
  // speckle and grime
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rng() > 0.5 ? 'rgba(255,230,190,0.05)' : 'rgba(0,0,0,0.07)';
    g.fillRect(rng() * 1280, rng() * 720, 2, 2);
  }
  // a warm halo of candlelight behind the window
  const halo = g.createRadialGradient(402, 400, 60, 402, 400, 430);
  halo.addColorStop(0, 'rgba(255,190,90,0.16)');
  halo.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, 1280, 720);
  // candlelight licking in from the left edge of the wall, and a low
  // warm bloom rising along the floor line
  const edge = g.createLinearGradient(0, 0, 360, 0);
  edge.addColorStop(0, 'rgba(255,176,84,0.14)');
  edge.addColorStop(1, 'rgba(255,176,84,0)');
  g.fillStyle = edge;
  g.fillRect(0, 0, 360, 720);
  const sill = g.createLinearGradient(0, 540, 0, 720);
  sill.addColorStop(0, 'rgba(255,170,80,0)');
  sill.addColorStop(1, 'rgba(255,170,80,0.08)');
  g.fillStyle = sill;
  g.fillRect(0, 540, 1280, 180);
  // pilasters flanking the window bay
  for (const px of [92, 678]) {
    g.fillStyle = '#2c2013';
    g.fillRect(px, 84, 40, 536);
    g.fillStyle = '#453322';
    g.fillRect(px - 6, 84, 52, 18);
    g.fillRect(px - 6, 602, 52, 18);
    g.fillStyle = 'rgba(255,220,160,0.06)';
    g.fillRect(px + 4, 102, 6, 500);
  }
}

function buildGlass() {
  for (const [name, hue] of Object.entries(HUES)) {
    glassTextures[name] = [];
    for (let v = 0; v < 3; v++) {
      const c = makeCanvas(168, 168);
      const g = c.getContext('2d');
      const rng = mulberry32(9000 + v * 131 + name.length * 977 + name.charCodeAt(0) * 31);
      g.fillStyle = hue.base;
      g.fillRect(0, 0, 168, 168);
      // cathedral-glass streaks: soft vertical-ish bands of light and dark
      for (let i = 0; i < 26; i++) {
        g.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
        const x = rng() * 168, w = 3 + rng() * 16;
        g.fillRect(x, 0, w, 168);
      }
      // seeds and bubbles
      for (let i = 0; i < 240; i++) {
        g.fillStyle = rng() > 0.55 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
        g.beginPath();
        g.arc(rng() * 168, rng() * 168, 0.6 + rng() * 1.5, 0, Math.PI * 2);
        g.fill();
      }
      // one brighter heart where the light catches
      const grad = g.createRadialGradient(50 + rng() * 60, 40 + rng() * 50, 4, 84, 84, 130);
      grad.addColorStop(0, 'rgba(255,255,255,0.20)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 168, 168);
      glassTextures[name].push(c);
    }
  }
}

function ensureTextures() {
  if (!wallCanvas) { buildWall(); buildGlass(); }
}

// ------------------------------------------------------------ path helpers

function tracePoints(g, points) {
  g.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
}

function traceShard(g, shard, scaleOverride) {
  const s = scaleOverride ?? shard.scale;
  const rot = (shard.rotation * Math.PI) / 180;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  g.beginPath();
  shard.points.forEach(([px, py], i) => {
    const x = shard.x + (px * cos - py * sin) * s;
    const y = shard.y + (px * sin + py * cos) * s;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  });
  g.closePath();
}

function bboxOf(points) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1 - x0, y1 - y0];
}

const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

// Fill a clipped path with a shard's glass: texture, depth shading, sheen.
function fillGlass(g, hueName, seedKey, bbox) {
  const hue = HUES[hueName];
  const tex = glassTextures[hueName][hashStr(seedKey) % 3];
  const [x, y, w, h] = bbox;
  g.save();
  g.clip();
  g.fillStyle = hue.base;
  g.fillRect(x, y, w, h);
  g.globalAlpha = 0.88;
  g.drawImage(tex, x, y, w, h);
  g.globalAlpha = 1;
  const shade = g.createLinearGradient(x, y, x, y + h);
  shade.addColorStop(0, 'rgba(255,255,255,0.13)');
  shade.addColorStop(0.45, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.20)');
  g.fillStyle = shade;
  g.fillRect(x, y, w, h);
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ------------------------------------------------------------ the chapel

function drawFloor(g, state) {
  const grad = g.createLinearGradient(0, 612, 0, 720);
  grad.addColorStop(0, '#31241a');
  grad.addColorStop(1, '#1d130b');
  g.fillStyle = grad;
  g.fillRect(0, 612, 1280, 108);
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  for (const y of [638, 668, 700]) { g.beginPath(); g.moveTo(0, y); g.lineTo(1280, y); g.stroke(); }
  g.strokeStyle = 'rgba(255,215,150,0.05)';
  for (let i = 0; i < 9; i++) {
    g.beginPath(); g.moveTo(140 + i * 130, 612); g.lineTo(60 + i * 150, 720); g.stroke();
  }
  // light shafts from every sealed circuit (the pools are drawn later,
  // over the darkness — light punches through the gloom)
  const win = state.win;
  win.circuits.forEach((circuit, i) => {
    if (!circuit.sealed) return;
    const hue = HUES[circuit.hue];
    const px = win.def.cx + (i - (win.circuits.length - 1) / 2) * 66;
    g.save();
    g.beginPath();
    g.moveTo(win.def.cx - 120, 606);
    g.lineTo(win.def.cx + 120, 606);
    g.lineTo(px + 150, 690);
    g.lineTo(px - 150, 690);
    g.closePath();
    g.fillStyle = hue.glow;
    g.globalAlpha = 0.11;
    g.fill();
    // a narrower, brighter core to the shaft
    g.beginPath();
    g.moveTo(win.def.cx - 46, 606);
    g.lineTo(win.def.cx + 46, 606);
    g.lineTo(px + 62, 690);
    g.lineTo(px - 62, 690);
    g.closePath();
    g.globalAlpha = 0.07;
    g.fill();
    g.restore();
  });
}

function drawPools(g, state) {
  const win = state.win;
  // one soft pool per sealed pane, tinted with the pane's own hue and
  // centred under its sector — the floor reads like spilled light
  for (const circuit of win.circuits) {
    if (!circuit.sealed) continue;
    for (const slot of win.slots.values()) {
      if (slot.circuit !== circuit.id || !slot.placed) continue;
      const hue = HUES[slot.hue];
      const px = slot.c[0] + (slot.c[0] - win.def.cx) * 0.22; // splayed a little outward
      const pool = g.createRadialGradient(px, 668, 4, px, 668, 94);
      pool.addColorStop(0, hue.glow + '66');
      pool.addColorStop(1, hue.glow + '00');
      g.save();
      g.translate(px, 668);
      g.scale(1, 0.30);
      g.translate(-px, -668);
      g.fillStyle = pool;
      g.beginPath(); g.arc(px, 668, 94, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }
  // the broad wash of each sealed circuit lying over the small pools
  win.circuits.forEach((circuit, i) => {
    if (!circuit.sealed) return;
    const hue = HUES[circuit.hue];
    const px = win.def.cx + (i - (win.circuits.length - 1) / 2) * 66;
    const pool = g.createRadialGradient(px, 664, 6, px, 664, 185);
    pool.addColorStop(0, hue.glow + '59');
    pool.addColorStop(1, hue.glow + '00');
    g.save();
    g.translate(px, 664);
    g.scale(1, 0.30);
    g.translate(-px, -664);
    g.fillStyle = pool;
    g.beginPath(); g.arc(px, 664, 185, 0, Math.PI * 2); g.fill();
    g.restore();
  });
}

function drawWindowFrame(g, state) {
  const { def } = state.win;
  g.save();
  if (def.kind === 'rose') {
    g.beginPath(); g.arc(def.cx, def.cy, def.frameR + 13, 0, Math.PI * 2);
    g.strokeStyle = '#241a10'; g.lineWidth = 30; g.stroke();
    g.beginPath(); g.arc(def.cx, def.cy, def.frameR + 13, 0, Math.PI * 2);
    g.strokeStyle = '#54402a'; g.lineWidth = 22; g.stroke();
    g.beginPath(); g.arc(def.cx, def.cy, def.frameR + 24, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(255,220,160,0.10)'; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.arc(def.cx, def.cy, def.frameR - 2, 0, Math.PI * 2);
    g.strokeStyle = '#14100c'; g.lineWidth = 7; g.stroke();
  } else {
    // pointed arch: jambs + two parabolic sweeps to the apex
    const W = 316, H = 424;
    const x0 = def.cx - W / 2, x1 = def.cx + W / 2, yBot = def.cy + H / 2, yTop = def.cy - H / 2;
    const archPath = (inset) => {
      g.beginPath();
      g.moveTo(x0 + inset, yBot);
      g.lineTo(x0 + inset, yTop + 118);
      for (let i = 1; i <= 20; i++) {
        const t = i / 20, x = x0 + inset + (def.cx - x0 - inset) * t;
        g.lineTo(x, yTop + 118 * (1 - t) * (1 - t));
      }
      for (let i = 1; i <= 20; i++) {
        const t = i / 20, x = def.cx + (x1 - inset - def.cx) * t;
        g.lineTo(x, yTop + 118 * t * t);
      }
      g.lineTo(x1 - inset, yBot);
    };
    archPath(0);
    g.strokeStyle = '#241a10'; g.lineWidth = 30; g.stroke();
    archPath(0);
    g.strokeStyle = '#54402a'; g.lineWidth = 22; g.stroke();
    archPath(13);
    g.strokeStyle = '#14100c'; g.lineWidth = 6; g.stroke();
  }
  g.restore();
}

function drawSlots(g, state) {
  const win = state.win;
  for (const slot of win.slots.values()) {
    const hue = HUES[slot.hue];
    if (slot.placed) continue;
    // an empty slot is a dark socket holding only a faint ghost of its hue
    tracePoints(g, slot.points);
    g.fillStyle = 'rgba(9,6,11,0.62)';
    g.fill();
    tracePoints(g, slot.points);
    g.fillStyle = hue.base + '1f';
    g.fill();
    g.strokeStyle = 'rgba(10,6,4,0.5)';
    g.lineWidth = 5;
    g.stroke();
    tracePoints(g, slot.points);
    g.strokeStyle = hue.light + '59';
    g.lineWidth = 1.6;
    g.stroke();
  }
  // the dragged shard's home slot beckons when it comes near
  const dragShard = state.drag?.shard;
  if (dragShard && dragShard.slotId) {
    const home = win.slots.get(dragShard.slotId);
    if (home && !home.placed && Math.hypot(dragShard.x - home.c[0], dragShard.y - home.c[1]) < 110) {
      tracePoints(g, home.points);
      g.strokeStyle = `rgba(255,240,200,${0.55 + 0.3 * Math.sin(state.time * 7)})`;
      g.lineWidth = 3.5;
      g.stroke();
    }
  }
  // placed glass
  for (const shard of win.shards) {
    if (!shard.placed) continue;
    const slot = win.slots.get(shard.slotId);
    tracePoints(g, slot.points);
    fillGlass(g, shard.hue, shard.id, bboxOf(slot.points));
    tracePoints(g, slot.points);
    g.strokeStyle = '#16110c';
    g.lineWidth = 5.5;
    g.stroke();
    const circuit = win.circuits.find((c) => c.id === slot.circuit);
    if (circuit.sealed) {
      // sealed glass is luminous: daylight pours THROUGH it, lit from
      // above, saturated with its own hue
      const [sx, sy, sw, sh] = bboxOf(slot.points);
      tracePoints(g, slot.points);
      const lum = g.createLinearGradient(sx, sy, sx, sy + sh);
      lum.addColorStop(0, HUES[shard.hue].light + '73');
      lum.addColorStop(0.55, HUES[shard.hue].glow + '40');
      lum.addColorStop(1, 'rgba(255,240,200,0.10)');
      g.fillStyle = lum;
      g.fill();
      tracePoints(g, slot.points);
      g.strokeStyle = HUES[shard.hue].glow + 'cc';
      g.lineWidth = 2;
      g.stroke();
    }
  }
  // mullion bars over the arch window's grid
  if (win.def.kind === 'arch') {
    g.strokeStyle = 'rgba(16,12,9,0.85)';
    g.lineWidth = 5;
    const W = 316, H = 424, x0 = win.def.cx - W / 2, yTop = win.def.cy - H / 2;
    for (let c = 1; c < 4; c++) {
      g.beginPath(); g.moveTo(x0 + c * (W / 4), yTop + 108); g.lineTo(x0 + c * (W / 4), win.def.cy + H / 2); g.stroke();
    }
    for (const ry of [128, 226, 322]) {
      g.beginPath(); g.moveTo(x0, yTop + ry); g.lineTo(x0 + W, yTop + ry); g.stroke();
    }
  }
  // the medallion's stone boss
  if (win.def.kind === 'rose') {
    g.beginPath(); g.arc(win.def.cx, win.def.cy, 11, 0, Math.PI * 2);
    g.fillStyle = '#4c3823'; g.fill();
    g.strokeStyle = '#17110b'; g.lineWidth = 3; g.stroke();
  }
}

function drawSeams(g, state) {
  const win = state.win;
  for (const circuit of win.circuits) {
    // the inlaid channel, always visible as a groove in the glass
    tracePoints(g, circuit.path);
    g.strokeStyle = 'rgba(12,8,5,0.42)';
    g.lineWidth = 4;
    g.stroke();
    if (circuit.sealed) {
      tracePoints(g, circuit.path);
      g.strokeStyle = '#e8b64c';
      g.lineWidth = 3.5;
      g.stroke();
      continue;
    }
    if (!circuit.ready) continue;
    const pulse = 0.6 + 0.4 * Math.sin(state.time * 5);
    tracePoints(g, circuit.path);
    g.strokeStyle = `rgba(255,190,70,${0.20 * pulse})`;
    g.lineWidth = 11;
    g.stroke();
    tracePoints(g, circuit.path);
    g.strokeStyle = `rgba(255,205,90,${0.85 * pulse})`;
    g.lineWidth = 3.5;
    g.stroke();
    // the soldered portion: bright gold runs over the samples
    g.save();
    g.strokeStyle = '#ffd76a';
    g.lineWidth = 6;
    g.shadowColor = '#ffb52e';
    g.shadowBlur = 12;
    g.beginPath();
    let pen = false;
    for (const s of circuit.samples) {
      if (s.done) { if (!pen) { g.moveTo(s.x, s.y); pen = true; } else g.lineTo(s.x, s.y); }
      else pen = false;
    }
    g.stroke();
    g.restore();
  }
}

function drawTray(g, state) {
  const win = state.win;
  const rows = Math.ceil(win.shards.length / TRAY.cols);
  const panelH = TRAY.header + rows * TRAY.cell + 16;
  g.save();
  roundRect(g, TRAY.x - 16, TRAY.y - 10, TRAY.cols * TRAY.cell + 32, panelH, 10);
  const wood = g.createLinearGradient(0, TRAY.y, 0, TRAY.y + panelH);
  wood.addColorStop(0, '#503722');
  wood.addColorStop(1, '#3a2716');
  g.fillStyle = wood;
  g.fill();
  g.strokeStyle = '#221507';
  g.lineWidth = 3;
  g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 2;
  for (let y = TRAY.y + 44; y < TRAY.y + panelH - 8; y += 44) {
    g.beginPath(); g.moveTo(TRAY.x - 10, y); g.lineTo(TRAY.x + TRAY.cols * TRAY.cell + 10, y); g.stroke();
  }
  g.fillStyle = '#f3d9a4';
  g.font = `700 15px ${SANS}`;
  g.textAlign = 'left';
  g.fillText('THE WORKBENCH', TRAY.x - 2, TRAY.y + 12);
  g.fillStyle = 'rgba(243,217,164,0.65)';
  g.font = `12px ${SANS}`;
  const left = win.shards.filter((s) => !s.placed).length;
  g.fillText(`${left} shard${left === 1 ? '' : 's'} on the bench`, TRAY.x - 2, TRAY.y + 28);
  // the glazier's kit along the bench's bottom edge: a lit lantern and a
  // stack of lead came strips, there whether the bench is full or bare
  const baseY = TRAY.y + panelH - 30;
  const lx = TRAY.x + TRAY.cols * TRAY.cell - 34;
  const lampGlow = g.createRadialGradient(lx, baseY - 8, 2, lx, baseY - 8, 44);
  lampGlow.addColorStop(0, 'rgba(255,190,90,0.5)');
  lampGlow.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = lampGlow;
  g.fillRect(lx - 44, baseY - 52, 88, 88);
  g.fillStyle = '#241708';
  roundRect(g, lx - 11, baseY - 24, 22, 30, 4);
  g.fill();
  g.fillStyle = `rgba(255,196,80,${0.75 + 0.2 * Math.sin(state.time * 7)})`;
  g.beginPath(); g.arc(lx, baseY - 9, 5.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,220,160,0.5)';
  g.lineWidth = 1.5;
  roundRect(g, lx - 11, baseY - 24, 22, 30, 4);
  g.stroke();
  g.fillStyle = 'rgba(20,14,10,0.75)';
  for (let i = 0; i < 3; i++) g.fillRect(TRAY.x + 2, baseY - 4 + i * 7, 120 - i * 14, 4);
  g.fillStyle = 'rgba(255,220,160,0.20)';
  for (let i = 0; i < 3; i++) g.fillRect(TRAY.x + 2, baseY - 4 + i * 7, 120 - i * 14, 1.4);
  g.restore();
  // the shards resting on the bench
  for (const shard of win.shards) {
    if (shard.placed || state.drag?.shard === shard) continue;
    drawBenchShard(g, state, shard);
  }
}

function drawBenchShard(g, state, shard) {
  const hovered = state.hoverShard === shard;
  traceShard(g, shard);
  const r = shard.maxR * shard.scale;
  fillGlass(g, shard.hue, shard.id, [shard.x - r, shard.y - r, r * 2, r * 2]);
  traceShard(g, shard);
  g.strokeStyle = hovered ? '#ffdf8a' : '#16110c';
  g.lineWidth = hovered ? 3.5 : 3;
  g.stroke();
  if (hovered) {
    traceShard(g, shard);
    g.strokeStyle = 'rgba(255,215,120,0.35)';
    g.lineWidth = 7;
    g.stroke();
  }
}

function drawDragged(g, state) {
  const shard = state.drag?.shard;
  if (!shard) return;
  // a soft shadow on the wall beneath the lifted shard
  g.save();
  g.beginPath();
  g.ellipse(shard.x + 7, shard.y + 10, shard.maxR * 0.8, shard.maxR * 0.5, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.fill();
  g.restore();
  traceShard(g, shard, 1);
  const r = shard.maxR;
  fillGlass(g, shard.hue, shard.id, [shard.x - r, shard.y - r, r * 2, r * 2]);
  traceShard(g, shard, 1);
  g.strokeStyle = '#0f0b08';
  g.lineWidth = 5;
  g.stroke();
  traceShard(g, shard, 1);
  g.strokeStyle = 'rgba(255,230,170,0.5)';
  g.lineWidth = 1.6;
  g.stroke();
}

function drawMotes(g, state) {
  g.save();
  for (const m of state.motes) {
    const tw = 0.5 + 0.5 * Math.sin(state.time * 0.7 + m.phase);
    g.beginPath();
    g.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    g.fillStyle = `rgba(255,226,170,${0.05 + 0.13 * tw})`;
    g.fill();
  }
  // brighter dust hanging in the light shaft beneath the window,
  // there while any sealed circuit is throwing its light
  if (state.win.circuits.some((c) => c.sealed)) {
    const rng = mulberry32(777);
    for (let i = 0; i < 30; i++) {
      const bx = 190 + rng() * 430, by = 470 + rng() * 200, ph = rng() * Math.PI * 2;
      const x = bx + Math.sin(state.time * 0.5 + ph) * 6;
      const y = by + Math.sin(state.time * 0.33 + ph * 1.7) * 5;
      const tw = 0.5 + 0.5 * Math.sin(state.time * 0.9 + ph);
      g.beginPath();
      g.arc(x, y, 1.1, 0, Math.PI * 2);
      g.fillStyle = `rgba(255,232,180,${0.10 + 0.16 * tw})`;
      g.fill();
    }
  }
  g.restore();
}

function drawIgnitions(g, state) {
  const win = state.win;
  for (const ig of state.ignitions) {
    const circuit = win.circuits.find((c) => c.id === ig.circuitId);
    if (!circuit) continue;
    const t = ig.t;
    g.save();
    g.globalAlpha = (1 - t) * 0.5;
    tracePoints(g, circuit.path);
    g.strokeStyle = '#ffe9a8';
    g.lineWidth = 3 + t * 16;
    g.stroke();
    g.globalAlpha = (1 - t) * 0.20;
    for (const slot of win.slots.values()) {
      if (slot.circuit !== circuit.id) continue;
      tracePoints(g, slot.points);
      g.fillStyle = '#fff3c4';
      g.fill();
    }
    g.restore();
  }
}

function drawSolderTip(g, state) {
  const tip = state.solderTip;
  if (!tip) return;
  const grad = g.createRadialGradient(tip.x, tip.y, 1, tip.x, tip.y, 17);
  grad.addColorStop(0, 'rgba(255,252,235,0.95)');
  grad.addColorStop(0.35, 'rgba(255,196,64,0.75)');
  grad.addColorStop(1, 'rgba(255,150,30,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(tip.x, tip.y, 17, 0, Math.PI * 2); g.fill();
  const rng = mulberry32(Math.floor(state.time * 9) + 7);
  g.fillStyle = 'rgba(255,205,100,0.8)';
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2, d = 6 + rng() * 13;
    g.fillRect(tip.x + Math.cos(a) * d, tip.y + Math.sin(a) * d, 2, 2);
  }
}

// ------------------------------------------------------------ HUD

function bellClock(state) {
  const rate = state.win.def.darknessRate;
  const secs = Math.max(0, Math.round((100 - state.darkness) / rate));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function drawHUD(g, state) {
  const win = state.win;
  // header band
  g.fillStyle = 'rgba(16,10,6,0.88)';
  g.fillRect(0, 0, 1280, 58);
  g.fillStyle = 'rgba(255,205,120,0.25)';
  g.fillRect(0, 58, 1280, 1);
  g.textAlign = 'left';
  g.fillStyle = '#f3d9a4';
  g.font = `700 16px ${SANS}`;
  g.fillText(win.def.name, 16, 24);
  g.fillStyle = 'rgba(243,217,164,0.72)';
  g.font = `12.5px ${SANS}`;
  const real = [...win.slots.values()].length;
  const sealedCount = win.circuits.filter((c) => c.sealed).length;
  g.fillText(`SHARDS ${win.placedCount}/${real} · CIRCUITS ${sealedCount}/${win.circuits.length}`, 16, 44);
  g.textAlign = 'center';
  g.fillStyle = '#ffeec4';
  g.font = `700 15.5px ${SANS}`;
  g.fillText('RESTORE THE WINDOW — SEAL EVERY CIRCUIT BEFORE THE FINAL BELL', 640, 26);
  g.fillStyle = state.tracing || win.circuits.some((c) => c.ready)
    ? `rgba(255,205,90,${0.65 + 0.35 * Math.sin(state.time * 5)})` : 'rgba(255,238,196,0.6)';
  g.font = `12.5px ${SANS}`;
  const ready = win.circuits.find((c) => c.ready);
  g.fillText(state.tracing
    ? `SOLDERING ${state.tracing.name.toUpperCase()} — ${Math.round((state.tracing.samples.filter((s) => s.done).length / state.tracing.samples.length) * 100)}%`
    : ready ? `✦ ${ready.name.toUpperCase()} IS WHOLE — TRACE ITS GOLDEN SEAM TO SOLDER IT ✦`
    : 'WIN: every circuit sealed · LOSE: the darkness fills before the window is whole', 640, 45);
  g.textAlign = 'right';
  g.fillStyle = '#ffeec4';
  g.font = `700 21px ${SANS}`;
  g.fillText(`SCORE ${fmt(state.score)}`, 1264, 25);
  g.fillStyle = state.streak >= 2 ? '#ffd76a' : 'rgba(255,238,196,0.55)';
  g.font = `700 13.5px ${SANS}`;
  g.fillText(state.streak >= 2 ? `STREAK ×${state.streak}` : 'STREAK —', 1264, 45);
  // darkness bar
  g.fillStyle = 'rgba(10,7,16,0.92)';
  g.fillRect(0, 59, 1280, 24);
  const dw = (state.darkness / 100) * 1280;
  const dgrad = g.createLinearGradient(0, 0, 1280, 0);
  dgrad.addColorStop(0, '#4a3a6e');
  dgrad.addColorStop(1, '#120a24');
  g.fillStyle = dgrad;
  g.fillRect(0, 59, dw, 24);
  g.fillStyle = 'rgba(190,170,255,0.85)';
  g.font = `700 12.5px ${SANS}`;
  g.textAlign = 'left';
  g.fillText(`☾ DARKNESS ${Math.floor(state.darkness)}%`, 16, 75);
  g.textAlign = 'right';
  g.fillStyle = state.darkness > 75 ? `rgba(255,150,120,${0.7 + 0.3 * Math.sin(state.time * 6)})` : 'rgba(230,220,255,0.8)';
  g.fillText(`FINAL BELL ${bellClock(state)}`, 1264, 75);
  // bottom hint strip
  g.fillStyle = 'rgba(16,10,6,0.85)';
  g.fillRect(0, 692, 1280, 28);
  g.fillStyle = 'rgba(243,217,164,0.6)';
  g.font = `12px ${SANS}`;
  g.textAlign = 'left';
  g.fillText('Drag shards from the bench · Q / E, mouse wheel or right-click rotates the held shard · hold & trace a golden seam to solder', 16, 710);
  // mute button
  const label = state.muted ? 'SOUND: OFF' : 'SOUND: ON';
  roundRect(g, 1152, 694, 112, 22, 5);
  g.fillStyle = 'rgba(60,42,24,0.9)';
  g.fill();
  g.strokeStyle = 'rgba(255,205,120,0.4)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = '#f3d9a4';
  g.font = `700 11.5px ${SANS}`;
  g.textAlign = 'center';
  g.fillText(label, 1208, 709);
  state.buttons.push({ id: 'mute', x: 1152, y: 694, w: 112, h: 22 });
}

function drawDarkness(g, state) {
  const d = state.darkness / 100;
  if (d <= 0.01) return;
  // cold wash desaturating the scene
  g.fillStyle = `rgba(38,40,74,${d * 0.16})`;
  g.fillRect(0, 0, 1280, 720);
  // the creep from the edges
  const grad = g.createRadialGradient(402, 400, 150, 402, 400, 720);
  grad.addColorStop(0, 'rgba(4,3,10,0)');
  grad.addColorStop(1, `rgba(4,3,10,${0.16 + d * 0.52})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1280, 720);
  // and it grips hardest from the bench side, swallowing the right wall
  // (the bench itself is drawn after this, lantern-lit against the gloom)
  const creep = g.createLinearGradient(1280, 0, 620, 0);
  creep.addColorStop(0, `rgba(5,4,12,${d * 0.5})`);
  creep.addColorStop(1, 'rgba(5,4,12,0)');
  g.fillStyle = creep;
  g.fillRect(620, 0, 660, 720);
}

function drawFloaters(g, state) {
  for (const f of state.floaters) {
    const a = Math.min(1, (f.life / f.maxLife) * 2.4);
    const pop = f.life > f.maxLife - 0.16 ? 1 + (f.life - (f.maxLife - 0.16)) * 1.1 : 1;
    g.save();
    g.globalAlpha = a;
    g.font = `${f.bold ? '800' : '600'} ${Math.round(f.size * pop)}px ${SANS}`;
    g.textAlign = 'center';
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(20,10,4,0.85)';
    g.strokeText(f.text, f.x, f.y);
    g.fillStyle = f.color;
    g.fillText(f.text, f.x, f.y);
    g.restore();
  }
}

// ------------------------------------------------------------ screens

function panel(g, x, y, w, h) {
  roundRect(g, x, y, w, h, 14);
  g.fillStyle = 'rgba(24,15,9,0.94)';
  g.fill();
  g.strokeStyle = 'rgba(255,196,90,0.55)';
  g.lineWidth = 2;
  g.stroke();
  roundRect(g, x + 7, y + 7, w - 14, h - 14, 10);
  g.strokeStyle = 'rgba(255,196,90,0.18)';
  g.lineWidth = 1;
  g.stroke();
}

function button(g, state, id, x, y, w, h, label, accent = false) {
  roundRect(g, x, y, w, h, 9);
  const grad = g.createLinearGradient(0, y, 0, y + h);
  if (accent) { grad.addColorStop(0, '#a8742a'); grad.addColorStop(1, '#7c521c'); }
  else { grad.addColorStop(0, '#503722'); grad.addColorStop(1, '#3a2716'); }
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = 'rgba(255,205,120,0.65)';
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = '#ffeec4';
  g.font = `700 16px ${SANS}`;
  g.textAlign = 'center';
  g.fillText(label, x + w / 2, y + h / 2 + 5.5);
  state.buttons.push({ id, x, y, w, h });
}

function drawTitle(g, state) {
  // dawn sky
  const sky = g.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, '#141c3d');
  sky.addColorStop(0.45, '#3d2340');
  sky.addColorStop(0.72, '#8a4a2a');
  sky.addColorStop(1, '#c9822e');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1280, 720);
  // hills
  g.fillStyle = '#131022';
  g.beginPath();
  g.moveTo(0, 560);
  for (let x = 0; x <= 1280; x += 80) g.lineTo(x, 548 - Math.sin(x * 0.006) * 42 - (x % 240 === 0 ? 16 : 0));
  g.lineTo(1280, 720); g.lineTo(0, 720);
  g.closePath(); g.fill();
  // the chapel silhouette with its one lit rose window
  g.fillStyle = '#0d0a16';
  g.fillRect(452, 300, 376, 262);
  g.beginPath();
  g.moveTo(428, 302); g.lineTo(640, 168); g.lineTo(852, 302); g.closePath(); g.fill();
  g.fillRect(612, 118, 56, 66);
  const cx = 640, cy = 392, R = 96;
  const glow = g.createRadialGradient(cx, cy, 8, cx, cy, R * 2.1);
  glow.addColorStop(0, 'rgba(255,190,90,0.5)');
  glow.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = glow;
  g.fillRect(cx - R * 2.1, cy - R * 2.1, R * 4.2, R * 4.2);
  const mini = ['ruby', 'amber', 'sapphire', 'emerald', 'violet', 'teal', 'rose', 'gold'];
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a0) * 34, cy + Math.sin(a0) * 34);
    g.arc(cx, cy, R - 8, a0, a1);
    g.closePath();
    g.fillStyle = HUES[mini[i]].base;
    g.fill();
  }
  g.beginPath(); g.arc(cx, cy, 32, 0, Math.PI * 2);
  g.fillStyle = HUES.amber.base; g.fill();
  g.beginPath(); g.arc(cx, cy, R - 4, 0, Math.PI * 2);
  g.strokeStyle = '#05040a'; g.lineWidth = 9; g.stroke();
  g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2);
  g.strokeStyle = '#05040a'; g.lineWidth = 6; g.stroke();
  // title
  g.textAlign = 'center';
  g.fillStyle = '#ffeec4';
  g.font = `700 62px ${SERIF}`;
  g.fillText('THE LAST GLAZIER', 640, 96);
  g.fillStyle = 'rgba(255,205,120,0.9)';
  g.fillRect(440, 116, 400, 2);
  g.fillStyle = 'rgba(255,238,196,0.92)';
  g.font = `italic 19px ${SERIF}`;
  g.fillText('The night is eating the light. Restore the great window before the final bell.', 640, 148);
  // how-to panel
  panel(g, 300, 486, 680, 128);
  g.textAlign = 'left';
  const rows = [
    ['FIT', '#7fd4ff', 'Drag each shard into its ghost outline. Q / E, the wheel or'],
    ['', '', 'right-click rotates it. First-try fits build your STREAK.'],
    ['SEAL', '#ffd76a', 'When a circuit is whole its seam glows gold — hold the'],
    ['', '', 'pointer down and trace the seam to run the molten solder.'],
    ['SURVIVE', '#c9a8ff', 'Darkness creeps in with the bell. Sealed circuits push it'],
    ['', '', 'back. If it fills before the window is whole, NIGHT FALLS.'],
  ];
  rows.forEach(([tag, color, text], i) => {
    const y = 518 + i * 17.5;
    if (tag) {
      g.fillStyle = color;
      g.font = `800 13.5px ${SANS}`;
      g.fillText(tag, 330, y);
    }
    g.fillStyle = 'rgba(255,240,210,0.92)';
    g.font = `13.5px ${SANS}`;
    g.fillText(text, 408, y);
  });
  button(g, state, 'start', 490, 634, 300, 46, 'BEGIN THE RESTORATION', true);
  g.fillStyle = 'rgba(255,238,196,0.55)';
  g.font = `12px ${SANS}`;
  g.textAlign = 'center';
  g.fillText('M — sound on / off', 640, 706);
}

function statRow(g, label, value, x, y, w) {
  g.textAlign = 'left';
  g.fillStyle = 'rgba(255,240,210,0.85)';
  g.font = `14.5px ${SANS}`;
  g.fillText(label, x, y);
  g.textAlign = 'right';
  g.fillStyle = '#ffeec4';
  g.font = `700 14.5px ${SANS}`;
  g.fillText(value, x + w, y);
}

function drawTally(g, state) {
  g.fillStyle = 'rgba(8,5,3,0.55)';
  g.fillRect(0, 0, 1280, 720);
  const t = state.tally;
  panel(g, 340, 148, 600, 424);
  g.textAlign = 'center';
  g.fillStyle = '#ffd76a';
  g.font = `700 46px ${SERIF}`;
  g.fillText('DAWN BREAKS', 640, 224);
  g.fillStyle = 'rgba(255,238,196,0.9)';
  g.font = `italic 16.5px ${SERIF}`;
  g.fillText(`${t.name} is whole again.`, 640, 254);
  const x = 400, w = 480;
  statRow(g, 'Shards fitted', `${t.fits}`, x, 306, w);
  statRow(g, 'Perfect fits', `${t.perfects}`, x, 338, w);
  statRow(g, 'Circuits sealed', `${t.seals}`, x, 370, w);
  statRow(g, 'Darkness held at bay', `+${fmt(t.bonus)}`, x, 402, w);
  statRow(g, 'Window score', `+${fmt(t.subtotal)}`, x, 434, w);
  g.fillStyle = 'rgba(255,205,120,0.35)';
  g.fillRect(x, 452, w, 1);
  statRow(g, 'TOTAL SCORE', fmt(state.score), x, 482, w);
  button(g, state, 'next', 470, 506, 340, 44, 'RESTORE THE NEXT WINDOW →', true);
}

function drawDawn(g, state) {
  g.fillStyle = 'rgba(20,10,2,0.16)';
  g.fillRect(0, 0, 1280, 720);
  const warmth = g.createRadialGradient(402, 392, 60, 402, 392, 620);
  warmth.addColorStop(0, 'rgba(255,196,90,0.20)');
  warmth.addColorStop(1, 'rgba(255,196,90,0)');
  g.fillStyle = warmth;
  g.fillRect(0, 0, 1280, 720);
  // the panel sits aside, narrower, so the restored West Window —
  // the thing the whole night was for — shows beside it
  const PX = 552, PY = 120, PW = 600, PH = 472, CX = PX + PW / 2;
  panel(g, PX, PY, PW, PH);
  g.textAlign = 'center';
  g.fillStyle = '#ffd76a';
  g.font = `700 50px ${SERIF}`;
  g.fillText('DAWN BREAKS', CX, 196);
  g.fillStyle = 'rgba(255,238,196,0.92)';
  g.font = `italic 16.5px ${SERIF}`;
  g.fillText('The chapel is whole again — light pours through all three windows.', CX, 226);
  const x = PX + 58, w = PW - 116;
  state.runStats.forEach((t, i) => statRow(g, t.name, `+${fmt(t.subtotal + t.bonus)}`, x, 274 + i * 30, w));
  g.fillStyle = 'rgba(255,205,120,0.35)';
  g.fillRect(x, 274 + state.runStats.length * 30 + 2, w, 1);
  statRow(g, 'TOTAL SCORE', fmt(state.score), x, 274 + state.runStats.length * 30 + 34, w);
  g.fillStyle = 'rgba(255,240,210,0.8)';
  g.font = `13.5px ${SANS}`;
  g.fillText(`${state.totalFits} shards fitted · ${state.totalPerfects} perfect · best streak ×${state.bestStreak}`, CX, 274 + state.runStats.length * 30 + 66);
  button(g, state, 'again', CX - 150, 500, 300, 44, 'RESTORE AGAIN', true);
}

function drawNight(g, state) {
  g.fillStyle = 'rgba(2,2,8,0.62)';
  g.fillRect(0, 0, 1280, 720);
  panel(g, 350, 168, 580, 384);
  g.textAlign = 'center';
  g.fillStyle = '#b9a8e8';
  g.font = `700 48px ${SERIF}`;
  g.fillText('NIGHT FALLS', 640, 248);
  g.fillStyle = 'rgba(230,224,255,0.9)';
  g.font = `italic 16.5px ${SERIF}`;
  g.fillText(`The last light gutters out over ${state.win.def.short}.`, 640, 280);
  const x = 410, w = 460;
  statRow(g, 'Score when the dark came', fmt(state.score), x, 336, w);
  statRow(g, 'Shards fitted', `${state.totalFits}`, x, 368, w);
  statRow(g, 'Circuits sealed', `${state.totalSeals}`, x, 400, w);
  button(g, state, 'again', 490, 452, 300, 44, 'TRY AGAIN AT DUSK', true);
  g.fillStyle = 'rgba(230,224,255,0.55)';
  g.font = `12.5px ${SANS}`;
  g.fillText('Tip: seal a circuit early — every seal pushes the darkness back.', 640, 528);
}

// ------------------------------------------------------------ main entry

export function drawGame(g, state) {
  ensureTextures();
  state.buttons = [];
  if (state.screen === 'title') { drawTitle(g, state); return; }
  g.drawImage(wallCanvas, 0, 0);
  drawFloor(g, state);
  drawWindowFrame(g, state);
  drawSlots(g, state);
  drawSeams(g, state);
  drawIgnitions(g, state);
  if (state.screen !== 'dawn') drawDarkness(g, state); // dawn has broken: no gloom
  drawPools(g, state);
  drawTray(g, state);
  drawDragged(g, state);
  drawMotes(g, state);
  drawSolderTip(g, state);
  if (state.screen === 'playing') {
    drawHUD(g, state);
    drawFloaters(g, state);
  } else if (state.screen === 'tally') drawTally(g, state);
  else if (state.screen === 'dawn') drawDawn(g, state);
  else if (state.screen === 'night') drawNight(g, state);
}
