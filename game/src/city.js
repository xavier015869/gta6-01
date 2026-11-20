// city.js — Port Solana itself: a seeded, deterministic city generated once at load.
// It lays the road grid over the mainland and Solana Key, fills the blocks between roads with
// named buildings, parks, parking lots and plazas, plants the palms, marks the landmarks the
// story needs (the bank, the clinic, PSPD headquarters, Sol's garage, the harbour, the island
// safehouse), and answers the questions every other system asks: is this water, what does a
// circle bump into, where are the intersections traffic drives between.

import {
  WORLD_W, WORLD_H, MAINLAND, ISLAND, BRIDGE, ROAD_W, ROADS_X, ROADS_Y,
  ISLAND_ROADS_X, ISLAND_ROADS_Y, SIDEWALK,
} from './config.js';

// A small deterministic random generator (mulberry32): the same seed grows the same city on
// every machine, so a screenshot staged today looks like the game a player opens tomorrow.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHOP_NAMES = [
  'Café Marisol', 'Solana Surf Co.', 'Palma Records', 'Dulce Bakery', 'Neon Reef Tattoo',
  'Barbería Ortiz', 'Key Lime Pies', 'Marina Outfitters', 'Hotel Azul', 'Farmacia Sol',
  'Vinyl & Vice', 'Tacos El Faro', 'Solana Cycles', 'Pink Flamingo Bar', 'Libros del Mar',
];
const OFFICE_NAMES = [
  'Meridian Trust', 'Solana Shipping Lines', 'Coral Capital', 'Vantage Legal', 'Orbital Freight HQ',
  'Sunstate Insurance', 'Pelican Media Group', 'Harbourline Logistics',
];
const HOUSE_NAMES = ['Casa Palmera', 'Casa Brisa', 'Villa Tortuga', 'Casa Limón', 'Villa Coral'];
const WAREHOUSE_NAMES = ['Port Solana Freight', 'Coldstore Nine', 'Dockside Storage', 'Crane & Crate Co.'];
const ROOF_COLORS = ['#d96f4e', '#c95d63', '#e0a458', '#7fb3b0', '#e8e0cc', '#b56576', '#6d8ea0', '#e5989b'];
const WALL_COLORS = ['#f2e3c6', '#eccfb2', '#e6d7b8', '#f5ead2', '#dfc9a8', '#f0dcc0'];

// The land ranges the grid leaves between roads, as [start, end] pairs along one axis.
function landRanges(roads, extent) {
  const bounds = [0];
  for (const c of roads) bounds.push(c - ROAD_W / 2, c + ROAD_W / 2);
  bounds.push(extent);
  const ranges = [];
  for (let i = 0; i + 1 < bounds.length; i += 2) ranges.push([bounds[i], bounds[i + 1]]);
  return ranges;
}

export function generateCity(seed = 20261120) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const lots = [];
  const decor = []; // {kind: 'palm'|'tree'|'crate'|'fountain'|'bench'|'umbrella', x, y, r}
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  function addBuilding(x, y, w, h, name, height, palette) {
    const b = {
      x, y, w, h, name: name || '',
      height,
      wall: palette ? palette.wall : pick(WALL_COLORS),
      roof: palette ? palette.roof : pick(ROOF_COLORS),
    };
    buildings.push(b);
    return b;
  }

  function fillBlock(bx, by, bw, bh, district) {
    const x = bx + SIDEWALK, y = by + SIDEWALK, w = bw - SIDEWALK * 2, h = bh - SIDEWALK * 2;
    if (w < 60 || h < 60) return;
    const roll = rng();
    if (district === 'beach') {
      // The south shore: open sand, palms, one or two beach bars, umbrellas.
      for (let i = 0; i < 5; i++) decor.push({ kind: 'palm', x: x + rng() * w, y: y + rng() * h, r: 15 + rng() * 8 });
      for (let i = 0; i < 3; i++) decor.push({ kind: 'umbrella', x: x + rng() * w, y: y + rng() * h, r: 13 });
      if (roll < 0.5) addBuilding(x + w * 0.3, y + h * 0.2, 120, 70, 'The Salty Pelican', 14);
      return;
    }
    if (district === 'harbour') {
      addBuilding(x + 10, y + 10, w - 20, h * 0.52, pick(WAREHOUSE_NAMES), 18, { wall: '#b0a696', roof: '#7d7468' });
      for (let i = 0; i < 6; i++) decor.push({ kind: 'crate', x: x + 14 + rng() * (w - 40), y: y + h * 0.62 + rng() * (h * 0.3), r: 11 });
      return;
    }
    if (roll < 0.15) { // a park: grass, paths and shade trees
      const park = { x, y, w, h };
      parks.push(park);
      for (let i = 0; i < 8; i++) decor.push({ kind: rng() < 0.4 ? 'palm' : 'tree', x: x + 18 + rng() * (w - 36), y: y + 18 + rng() * (h - 36), r: 14 + rng() * 9 });
      for (let i = 0; i < 3; i++) decor.push({ kind: 'bench', x: x + rng() * w, y: y + rng() * h, r: 8 });
      return;
    }
    if (roll < 0.28) { // a parking lot with marked bays along both long sides
      const lot = { x, y, w, h, spots: [] };
      const per = Math.floor(w / 58);
      for (let i = 0; i < per; i++) {
        lot.spots.push({ x: x + 32 + i * 58, y: y + 30, angle: Math.PI / 2 });
        lot.spots.push({ x: x + 32 + i * 58, y: y + h - 30, angle: -Math.PI / 2 });
      }
      lots.push(lot);
      return;
    }
    if (roll < 0.34) { // a plaza: open stone, a fountain, palms at the corners
      decor.push({ kind: 'fountain', x: x + w / 2, y: y + h / 2, r: 30 });
      for (const [cx, cy] of [[x + 22, y + 22], [x + w - 22, y + 22], [x + 22, y + h - 22], [x + w - 22, y + h - 22]]) {
        decor.push({ kind: 'palm', x: cx, y: cy, r: 15 });
      }
      return;
    }
    if (district === 'downtown') {
      // Towers: one or two tall slabs per block, with a setback court between them.
      const two = rng() < 0.55;
      const name = pick(OFFICE_NAMES);
      if (two) {
        addBuilding(x + 8, y + 8, w * 0.44, h - 16, name, 54 + rng() * 30);
        addBuilding(x + w * 0.56, y + 8, w * 0.4, h - 16, rng() < 0.5 ? pick(SHOP_NAMES) : '', 30 + rng() * 22);
      } else {
        addBuilding(x + w * 0.14, y + h * 0.1, w * 0.72, h * 0.8, name, 62 + rng() * 30);
      }
      return;
    }
    if (district === 'boulevard') {
      // Shops shoulder to shoulder along the street: two or three small, named, bright boxes.
      const n = 2 + Math.floor(rng() * 2);
      const sw = w / n;
      for (let i = 0; i < n; i++) {
        addBuilding(x + i * sw + 5, y + h * 0.16, sw - 10, h * 0.62, pick(SHOP_NAMES), 15 + rng() * 7);
      }
      return;
    }
    if (district === 'island') {
      addBuilding(x + w * 0.18, y + h * 0.2, w * 0.6, h * 0.5, rng() < 0.6 ? pick(HOUSE_NAMES) : 'Key Groceries', 13);
      for (let i = 0; i < 4; i++) decor.push({ kind: 'palm', x: x + rng() * w, y: y + rng() * h, r: 15 + rng() * 7 });
      return;
    }
    // Residential: a few houses with gardens.
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const hw = 62 + rng() * 40, hh = 52 + rng() * 34;
      addBuilding(x + rng() * (w - hw), y + rng() * (h - hh), hw, hh, rng() < 0.3 ? pick(HOUSE_NAMES) : '', 11 + rng() * 5);
    }
    for (let i = 0; i < 3; i++) decor.push({ kind: 'tree', x: x + rng() * w, y: y + rng() * h, r: 12 + rng() * 6 });
  }

  // Mainland blocks.
  const cols = landRanges(ROADS_X, MAINLAND.w);
  const rows = landRanges(ROADS_Y, MAINLAND.h);
  for (let ci = 0; ci < cols.length; ci++) {
    for (let ri = 0; ri < rows.length; ri++) {
      const [x0, x1] = cols[ci], [y0, y1] = rows[ri];
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      let district = 'residential';
      if (ri === rows.length - 1) district = 'beach';
      else if (cx > 2850 && cy > 1850) district = 'harbour';
      else if (cx > 1240 && cx < 2950 && cy > 700 && cy < 2450) district = 'downtown';
      else if (Math.abs(cy - 1860) < 560) district = 'boulevard';
      fillBlock(x0, y0, x1 - x0, y1 - y0, district);
    }
  }

  // Island blocks (ranges rebuilt with absolute road lines).
  const icolsAbs = [];
  {
    const bounds = [ISLAND.x];
    for (const c of ISLAND_ROADS_X) bounds.push(c - ROAD_W / 2, c + ROAD_W / 2);
    bounds.push(ISLAND.x + ISLAND.w);
    for (let i = 0; i + 1 < bounds.length; i += 2) icolsAbs.push([bounds[i], bounds[i + 1]]);
  }
  const irowsAbs = [];
  {
    const bounds = [ISLAND.y];
    for (const c of ISLAND_ROADS_Y) bounds.push(c - ROAD_W / 2, c + ROAD_W / 2);
    bounds.push(ISLAND.y + ISLAND.h);
    for (let i = 0; i + 1 < bounds.length; i += 2) irowsAbs.push([bounds[i], bounds[i + 1]]);
  }
  for (const [x0, x1] of icolsAbs) for (const [y0, y1] of irowsAbs) fillBlock(x0, y0, x1 - x0, y1 - y0, 'island');

  // Landmarks: named buildings the story leans on, placed on open ground in their districts.
  const landmarks = {};
  function landmark(key, x, y, w, h, name, height, palette) {
    const b = addBuilding(x, y, w, h, name, height, palette);
    landmarks[key] = { x: x + w / 2, y: y + h / 2, building: b, door: { x: x + w / 2, y: y + h + 26 } };
    return b;
  }
  landmark('police', 430, 420, 200, 130, 'PSPD Headquarters', 30, { wall: '#cfd6dd', roof: '#44586e' });
  landmark('hospital', 2560, 420, 210, 130, 'Clínica Solana', 26, { wall: '#f4f1e8', roof: '#c94f4f' });
  landmark('bank', 2050, 1470, 240, 150, 'Port Solana Bank', 44, { wall: '#e8ddba', roof: '#8c7a3f' });
  landmark('garage', 3030, 2050, 220, 140, "Sol's Customs", 18, { wall: '#d98e4a', roof: '#6e5136' });
  landmark('cafe', 980, 2070, 150, 100, 'Café Marisol', 14, { wall: '#f7d774', roof: '#c95d63' });
  landmark('safehouse', 4840, 2130, 170, 120, 'Casa Segura', 13, { wall: '#f2e3c6', roof: '#d96f4e' });

  // The harbour: dock fingers reaching south into the water from the mainland's south-east.
  const docks = [];
  for (let i = 0; i < 4; i++) docks.push({ x: 2980 + i * 110, y: MAINLAND.h, w: 54, h: 190 });
  landmarks.harbor = { x: 3200, y: 2980, door: { x: 3200, y: 2980 } };

  // Palms line the coast road and the beach wherever the blocks left sand.
  for (let x = 60; x < MAINLAND.w - 40; x += 130 + rng() * 90) {
    decor.push({ kind: 'palm', x, y: MAINLAND.h - 26 - rng() * 30, r: 15 + rng() * 7 });
  }

  // --- Spatial questions -------------------------------------------------------------

  function onLand(x, y) {
    return (x >= MAINLAND.x && x <= MAINLAND.x + MAINLAND.w && y >= MAINLAND.y && y <= MAINLAND.y + MAINLAND.h)
      || (x >= ISLAND.x && x <= ISLAND.x + ISLAND.w && y >= ISLAND.y && y <= ISLAND.y + ISLAND.h);
  }
  function onBridge(x, y) {
    return x >= BRIDGE.x && x <= BRIDGE.x + BRIDGE.w && y >= BRIDGE.y && y <= BRIDGE.y + BRIDGE.h;
  }
  function onDock(x, y) {
    return docks.some((d) => x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h);
  }
  function isWater(x, y) {
    return !onLand(x, y) && !onBridge(x, y) && !onDock(x, y);
  }

  // Push a circle out of every building it overlaps. Returns true when it touched anything.
  function collideCircle(pos, r) {
    let hit = false;
    for (const b of buildings) {
      if (pos.x < b.x - r || pos.x > b.x + b.w + r || pos.y < b.y - r || pos.y > b.y + b.h + r) continue;
      const nx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
      const ny = Math.max(b.y, Math.min(pos.y, b.y + b.h));
      let dx = pos.x - nx, dy = pos.y - ny;
      let d2 = dx * dx + dy * dy;
      if (d2 > r * r) continue;
      hit = true;
      if (d2 === 0) { // centre inside the rect: leave by the shortest side
        const left = pos.x - b.x, right = b.x + b.w - pos.x, top = pos.y - b.y, bot = b.y + b.h - pos.y;
        const m = Math.min(left, right, top, bot);
        if (m === left) pos.x = b.x - r; else if (m === right) pos.x = b.x + b.w + r;
        else if (m === top) pos.y = b.y - r; else pos.y = b.y + b.h + r;
        continue;
      }
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * r;
      pos.y = ny + (dy / d) * r;
    }
    return hit;
  }

  // Keep a circle on dry land: try the full move, then each axis alone; report if it was blocked.
  function moveCircle(pos, dx, dy, r) {
    const tryPos = { x: pos.x + dx, y: pos.y + dy };
    if (!isWater(tryPos.x, tryPos.y)) {
      pos.x = tryPos.x; pos.y = tryPos.y;
      return collideCircle(pos, r);
    }
    let hit = true;
    if (!isWater(pos.x + dx, pos.y)) { pos.x += dx; hit = collideCircle(pos, r) || hit; }
    if (!isWater(pos.x, pos.y + dy)) { pos.y += dy; hit = collideCircle(pos, r) || hit; }
    collideCircle(pos, r);
    return hit;
  }

  // Intersections: the nodes traffic drives between.
  const intersections = [];
  for (const vx of ROADS_X) for (const hy of ROADS_Y) intersections.push({ x: vx, y: hy });
  for (const vx of ISLAND_ROADS_X) for (const hy of ISLAND_ROADS_Y) intersections.push({ x: vx, y: hy });
  intersections.push({ x: MAINLAND.w, y: 1860 }, { x: ISLAND.x, y: 1860 });
  // Neighbours share a road line with no other node between them.
  const nodes = intersections.map((p, i) => ({ ...p, id: i, neighbors: [] }));
  for (const a of nodes) {
    for (const b of nodes) {
      if (a === b) continue;
      if (a.x === b.x || a.y === b.y) {
        const between = nodes.some((c) => c !== a && c !== b
          && ((a.x === b.x && c.x === a.x && Math.min(a.y, b.y) < c.y && c.y < Math.max(a.y, b.y))
            || (a.y === b.y && c.y === a.y && Math.min(a.x, b.x) < c.x && c.x < Math.max(a.x, b.x))));
        // Only join nodes on the same stretch of land or across the bridge.
        const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
        if (!between && (onLand(midX, midY) || onBridge(midX, midY))) a.neighbors.push(b);
      }
    }
  }

  function nearestNode(x, y) {
    let best = null, bd = Infinity;
    for (const n of nodes) {
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  function randomRoadPoint(r) {
    const n = nodes[Math.floor(r() * nodes.length)];
    return { x: n.x, y: n.y, node: n };
  }

  return {
    width: WORLD_W, height: WORLD_H,
    buildings, parks, lots, decor, docks, landmarks,
    nodes, nearestNode, randomRoadPoint,
    onLand, onBridge, onDock, isWater, collideCircle, moveCircle,
  };
}
