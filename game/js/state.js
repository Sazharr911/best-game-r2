// state.js — THE LAST GLAZIER's world definition: the jewel-glass palette,
// the geometry helpers that cut panes and seams, the three chapel windows
// (slots, circuits, solder paths, decoys), and the game state factory with
// the scoring rules. Rendering and input live elsewhere; everything here
// is deterministic (seeded) so staged scenes and textures never flicker
// between runs.

// ------------------------------------------------------------ palette

export const HUES = {
  ruby:     { base: '#b81f36', light: '#e5485f', dark: '#67101d', glow: '#ff5a70' },
  sapphire: { base: '#1f49b8', light: '#4a78e8', dark: '#102a6b', glow: '#6f9bff' },
  amber:    { base: '#d98a16', light: '#f5b73e', dark: '#85530b', glow: '#ffc95e' },
  emerald:  { base: '#178a4f', light: '#35c176', dark: '#0c5230', glow: '#5fe89e' },
  violet:   { base: '#6d2fc0', light: '#9a63e8', dark: '#3f1a73', glow: '#bb8fff' },
  teal:     { base: '#12808c', light: '#2fb3c2', dark: '#0a4d55', glow: '#5fdce8' },
  rose:     { base: '#c2447f', light: '#e87bab', dark: '#722545', glow: '#ff9cc4' },
  gold:     { base: '#c9a227', light: '#ecd06a', dark: '#77600f', glow: '#ffe98a' },
};
const RING_HUES = ['ruby', 'amber', 'sapphire', 'emerald', 'violet', 'teal', 'rose', 'gold'];

// ------------------------------------------------------------ small math

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rad = (deg) => (deg * Math.PI) / 180;
export const polar = (cx, cy, r, deg) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];

export function centroid(points) {
  let x = 0, y = 0;
  for (const p of points) { x += p[0]; y += p[1]; }
  return [x / points.length, y / points.length];
}

export function circlePoints(cx, cy, r, n = 30) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(polar(cx, cy, r, (i / n) * 360));
  return pts;
}

// An annulus wedge between two radii and two angles (degrees, 0 = east,
// clockwise positive because canvas y grows downward).
export function sectorPoints(cx, cy, rIn, rOut, a0, a1) {
  const steps = Math.max(3, Math.round((a1 - a0) / 9));
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(polar(cx, cy, rOut, a0 + ((a1 - a0) * i) / steps));
  for (let i = steps; i >= 0; i--) pts.push(polar(cx, cy, rIn, a0 + ((a1 - a0) * i) / steps));
  return pts;
}

// Resample a closed polyline into solder samples spaced ~step px apart.
export function resampleClosed(points, step = 7) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % n];
    const d = Math.hypot(x1 - x0, y1 - y0);
    const k = Math.max(1, Math.round(d / step));
    for (let j = 0; j < k; j++) out.push({ x: x0 + ((x1 - x0) * j) / k, y: y0 + ((y1 - y0) * j) / k, done: false });
  }
  return out;
}

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// ------------------------------------------------------------ the windows
// Every builder returns slots in SCREEN coordinates for a window centred
// at (cx, cy). A slot: { id, points, hue, circuit, spin } where spin is
// 'free' (rotation does not matter), 180 or 360 (the shard's rotation must
// match modulo that many degrees). A circuit: { id, name, hue, path } —
// the closed seam polyline the player solders once its panes are placed.

function roseWindow(cx, cy, rings, medallionHue) {
  // rings: [{ rIn, rOut, count, offset, hueOffset }]
  const slots = [];
  const circuits = [];
  slots.push({
    id: 'medallion', points: circlePoints(cx, cy, rings[0].rIn - 8), hue: medallionHue,
    circuit: 'c0', spin: 'free',
  });
  circuits.push({ id: 'c0', name: 'The Medallion', hue: medallionHue, path: circlePoints(cx, cy, rings[0].rIn - 8, 40) });
  rings.forEach((ring, ri) => {
    const cid = `c${ri + 1}`;
    const step = 360 / ring.count;
    for (let i = 0; i < ring.count; i++) {
      const a0 = ring.offset + i * step + 1.6;
      const a1 = ring.offset + (i + 1) * step - 1.6;
      slots.push({
        id: `${cid}s${i}`,
        points: sectorPoints(cx, cy, ring.rIn, ring.rOut, a0, a1),
        hue: RING_HUES[(i + ring.hueOffset) % RING_HUES.length],
        circuit: cid, spin: 360,
      });
    }
    const mid = (ring.rIn + ring.rOut) / 2;
    circuits.push({
      id: cid, name: ri === 0 ? (rings.length > 1 ? 'The Middle Ring' : 'The Inner Ring') : 'The Outer Ring',
      hue: RING_HUES[ring.hueOffset % RING_HUES.length], path: circlePoints(cx, cy, mid, 64),
    });
  });
  return { slots, circuits };
}

function westWindow(cx, cy) {
  // A pointed-arch window: four rows of panes, the top row following the
  // arch. Rows are the circuits; each row's seam is its own outline.
  const W = 316, H = 424;
  const x0 = cx - W / 2, x1 = cx + W / 2;
  const yBot = cy + H / 2, yTop = cy - H / 2;
  const archY = (x) => { // the arch's top edge at a given x: a parabola
    const t = Math.abs(x - cx) / (W / 2); // 1 at the jambs, 0 at the apex
    return yTop + 118 * t * t; // spring line 118 below the apex at the jambs
  };
  const rows = [ // [yTopOfRow, yBottomOfRow] top row is special (arch)
    [yTop, yTop + 128], [yTop + 128, yTop + 226], [yTop + 226, yTop + 322], [yTop + 322, yBot],
  ];
  const rowNames = ['The Arch Crown', 'The Upper Lights', 'The Lower Lights', 'The Base Course'];
  const rowHues = [
    ['gold', 'violet', 'violet', 'gold'],
    ['sapphire', 'ruby', 'ruby', 'sapphire'],
    ['emerald', 'amber', 'amber', 'emerald'],
    ['teal', 'rose', 'rose', 'teal'],
  ];
  const slots = [];
  const circuits = [];
  const cols = 4, gap = 7;
  const colW = W / cols;
  rows.forEach(([ry0, ry1], r) => {
    const cid = `c${r}`;
    for (let c = 0; c < cols; c++) {
      const px0 = x0 + c * colW + gap / 2, px1 = x0 + (c + 1) * colW - gap / 2;
      let points;
      if (r === 0) {
        const midX = (px0 + px1) / 2;
        points = [[px0, ry1], [px0, archY(px0)], [midX, archY(midX)], [px1, archY(px1)], [px1, ry1]];
      } else {
        points = rect(px0, ry0 + gap / 2, px1, ry1 - gap / 2);
      }
      slots.push({ id: `${cid}s${c}`, points, hue: rowHues[r][c], circuit: cid, spin: r === 0 ? 360 : 180 });
    }
    // the row's seam: its outline (arch-following for the crown row)
    let path;
    if (r === 0) {
      path = [];
      for (let i = 0; i <= 16; i++) { const x = x0 + (W * i) / 16; path.push([x, archY(x)]); }
      path.push([x1, ry1], [x0, ry1]);
    } else {
      path = rect(x0 + 2, ry0 + 2, x1 - 2, ry1 - 2);
    }
    circuits.push({ id: cid, name: rowNames[r], hue: rowHues[r][1], path });
  });
  // Three decoy shards: plausible glass that fits nowhere in this window.
  const decoys = [
    { points: rect(-34, -26, 34, 26), hue: 'violet' },
    { points: sectorPoints(0, 0, 30, 74, -24, 24), hue: 'ruby' },
    { points: [[0, -40], [30, 18], [-30, 18]], hue: 'emerald' },
  ];
  return { slots, circuits, decoys };
}

export function buildWindows() {
  const rose1 = roseWindow(402, 400, [{ rIn: 62, rOut: 172, count: 8, offset: 0, hueOffset: 0 }], 'amber');
  const rose2 = roseWindow(402, 400, [
    { rIn: 54, rOut: 124, count: 12, offset: 0, hueOffset: 2 },
    { rIn: 132, rOut: 204, count: 12, offset: 15, hueOffset: 5 },
  ], 'gold');
  const west = westWindow(402, 392);
  return [
    {
      name: 'I · THE CHAPEL ROSE', short: 'the Chapel Rose', kind: 'rose', cx: 402, cy: 400, frameR: 184,
      darknessRate: 100 / 170, ...rose1,
    },
    {
      name: 'II · THE GREAT ROSE', short: 'the Great Rose', kind: 'rose', cx: 402, cy: 400, frameR: 216,
      darknessRate: 100 / 235, ...rose2,
    },
    {
      name: 'III · THE WEST WINDOW', short: 'the West Window', kind: 'arch', cx: 402, cy: 392, frameR: 0,
      darknessRate: 100 / 265, ...west,
    },
  ];
}

// ------------------------------------------------------------ the tray

export const TRAY = { x: 812, y: 148, cols: 5, cell: 88, header: 34 };

// Lay a window's shards (plus decoys) into tray cells in a seeded order.
function makeShards(win, winIndex) {
  const rng = mulberry32(7100 + winIndex * 977);
  const items = win.slots.map((slot) => ({ slot }));
  for (const d of win.decoys ?? []) items.push({ decoy: d });
  // seeded shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items.map((item, i) => {
    const col = i % TRAY.cols, row = Math.floor(i / TRAY.cols);
    const tx = TRAY.x + col * TRAY.cell + TRAY.cell / 2;
    const ty = TRAY.y + TRAY.header + row * TRAY.cell + TRAY.cell / 2;
    const src = item.slot ? item.slot.points : item.decoy.points;
    const c = item.slot ? centroid(item.slot.points) : centroid(item.decoy.points);
    const rel = src.map(([x, y]) => [x - c[0], y - c[1]]);
    const maxR = Math.max(...rel.map(([x, y]) => Math.hypot(x, y)));
    return {
      id: item.slot ? item.slot.id : `decoy${i}`,
      slotId: item.slot ? item.slot.id : null,
      hue: item.slot ? item.slot.hue : item.decoy.hue,
      points: rel,
      maxR,
      trayScale: Math.min(1, 37 / maxR),
      homeX: tx, homeY: ty,
      x: tx, y: ty,
      rotation: item.slot && item.slot.spin === 'free' ? 0 : Math.floor(rng() * 24) * 15,
      placed: false, attempts: 0, scale: 0, // scale animates 0→trayScale on deal
    };
  });
}

// ------------------------------------------------------------ state

export function createGameState() {
  return {
    screen: 'title', // title | playing | tally | dawn | night
    staged: false,
    time: 0,
    windows: buildWindows(),
    winIndex: 0,
    win: null, // live per-window runtime (below)
    score: 0,
    streak: 0, bestStreak: 0,
    totalFits: 0, totalPerfects: 0, totalSeals: 0,
    runStats: [], // per-window tally rows
    tally: null, // the row being shown on the DAWN BREAKS screen
    darkness: 0,
    bells: { b70: false, b90: false },
    floaters: [],
    ignitions: [],
    motes: [],
    buttons: [],
    pointer: { x: -99, y: -99, down: false },
    drag: null, // { shard, dx, dy }
    hoverShard: null,
    solderTip: null, // { x, y } while a seam is being traced
    tracing: null, // circuit runtime being soldered
    sealHint: 0,
    muted: false,
  };
}

// Runtime view of one window: slots with placed flags, circuits with
// solder samples, shards in the tray.
export function loadWindow(state, index) {
  const def = state.windows[index];
  state.winIndex = index;
  state.darkness = 0;
  state.bells = { b70: false, b90: false };
  state.drag = null;
  state.tracing = null;
  const slots = new Map();
  for (const s of def.slots) slots.set(s.id, { ...s, placed: false, c: centroid(s.points) });
  const circuits = def.circuits.map((c) => ({
    ...c,
    samples: resampleClosed(c.path),
    doneOrder: [],
    ready: false, sealed: false, lastMark: -9,
  }));
  state.win = {
    def, slots, circuits,
    shards: makeShards(def, index),
    placedCount: 0,
    stats: { fits: 0, perfects: 0, seals: 0, scoreAtStart: state.score },
  };
  return state.win;
}

export function startRun(state) {
  const fresh = createGameState();
  fresh.muted = state.muted;
  Object.assign(state, fresh);
  loadWindow(state, 0);
  state.screen = 'playing';
}

// ------------------------------------------------------------ rules

export function circuitOf(state, circuitId) {
  return state.win.circuits.find((c) => c.id === circuitId);
}

export function addFloater(state, x, y, text, opts = {}) {
  state.floaters.push({
    x, y, text,
    vy: opts.vy ?? -44,
    life: opts.life ?? 1.15, maxLife: opts.life ?? 1.15,
    size: opts.size ?? 20,
    color: opts.color ?? '#ffe9b0',
    bold: opts.bold ?? true,
  });
}

export function angleFits(shard, slot) {
  if (slot.spin === 'free') return true;
  let d = ((shard.rotation % slot.spin) + slot.spin) % slot.spin;
  if (d > slot.spin / 2) d = slot.spin - d;
  return d <= 8 || slot.spin - d <= 8;
}

// Place a shard into its slot (shared by real drops and staged scenes).
export function placeShard(state, shard, { silent = false } = {}) {
  const slot = state.win.slots.get(shard.slotId);
  shard.placed = true;
  shard.x = slot.c[0]; shard.y = slot.c[1];
  shard.rotation = 0; shard.scale = 1;
  slot.placed = true;
  state.win.placedCount += 1;
  state.win.stats.fits += 1;
  state.totalFits += 1;
  const circuit = circuitOf(state, slot.circuit);
  const done = [...state.win.slots.values()].filter((s) => s.circuit === slot.circuit).every((s) => s.placed);
  if (done && !circuit.ready && !circuit.sealed) {
    circuit.ready = true;
    if (!silent) addFloater(state, state.win.def.cx, state.win.def.cy - 10, 'TRACE THE SOLDER!', { size: 25, color: '#ffd76a', life: 1.5 });
  }
  return circuit;
}

// Score a completed circuit and ignite it (shared by play and staging).
export function sealCircuit(state, circuit, { silent = false } = {}) {
  circuit.sealed = true;
  circuit.ready = false;
  for (const s of circuit.samples) s.done = true;
  const panes = [...state.win.slots.values()].filter((s) => s.circuit === circuit.id).length;
  const points = 100 * panes * Math.max(1, Math.min(state.streak, 5)); // streak multiplier capped at ×5
  state.score += points;
  state.win.stats.seals += 1;
  state.totalSeals += 1;
  state.darkness = Math.max(0, state.darkness - 18);
  state.ignitions.push({ circuitId: circuit.id, t: 0 });
  if (!silent) {
    addFloater(state, state.win.def.cx, state.win.def.cy - 26, `CIRCUIT SEALED! +${points.toLocaleString('en-US')}`, { size: 34, color: '#ffd76a', life: 1.7 });
  }
  return points;
}

export function windowComplete(state) {
  return state.win.circuits.every((c) => c.sealed);
}
