// city.js — Port Solana itself: the road grid, city blocks, buildings,
// landmarks, beach, sea and the offshore island, all generated from a
// fixed seed so the city is the same on every visit.
//
// The mainland is a 7x5 grid of blocks between two-way roads. East of the
// coast road lies the beach, then the sea, then Solana Key — a small
// island reached by one bridge. Every name in the city is invented.

import {
  WORLD_W, WORLD_H, PITCH, ROAD_W, BLOCK, COLS, ROWS,
  LAND_END, WATER_X, BRIDGE_Y, ISLAND, PALETTE,
} from './config.js';

// Deterministic RNG (mulberry32) so the city never changes shape.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const vRoadCenter = (i) => i * PITCH + ROAD_W / 2;
export const hRoadCenter = (j) => j * PITCH + ROAD_W / 2;

const SHOP_NAMES = [
  'Café Brisa', 'Panadería Sol', 'Farmacia Coral', 'Tienda Azul', 'Bar El Faro',
  'Helados Luna', 'Librería Mar', 'Floristería Iris', 'Taller Pepe', 'Cine Brisa',
  'Mercado Azul', 'Joyas del Mar', 'Peluquería Ola', 'Banco del Sol — Cajero',
];
const TOWER_NAMES = [
  'Torre Coral', 'Hotel Marisol', 'Banco del Sol', 'Torre Brisa', 'Edificio Faro',
  'Hotel Palma Real', 'Torre del Puerto', 'Condominio Ola', 'Torre Serena',
];
const HOUSE_STREETS = ['Calle Palma', 'Calle Brisa', 'Avenida del Sol', 'Calle Coral', 'Paseo del Mar'];

// Hand-planned block characters: D downtown towers, S shops, H homes,
// P park, L parking lot, G Sol's garage block, B bank block, W warehouse/harbor.
const BLOCK_PLAN = [
  // row 0 (north)
  ['H', 'S', 'D', 'D', 'S', 'H', 'P'],
  // row 1
  ['S', 'D', 'D', 'D', 'D', 'S', 'H'],
  // row 2
  ['H', 'S', 'D', 'B', 'S', 'L', 'S'],
  // row 3
  ['P', 'G', 'S', 'D', 'S', 'H', 'L'],
  // row 4 (south)
  ['W', 'H', 'S', 'P', 'H', 'S', 'H'],
];

function blockRect(col, row) {
  return {
    x: col * PITCH + ROAD_W,
    y: row * PITCH + ROAD_W,
    w: BLOCK,
    h: BLOCK,
  };
}

export function buildCity() {
  const rng = makeRng(20261120);
  const buildings = [];
  const palms = [];
  const trees = [];
  const parkingSpots = [];
  const crates = [];
  const blocks = [];

  const addBuilding = (x, y, w, h, floors, name, kind) => {
    const b = {
      x, y, w, h, floors,
      color: PALETTE.roof[Math.floor(rng() * PALETTE.roof.length)],
      name: name || null,
      kind: kind || 'block',
      seed: rng(),
    };
    buildings.push(b);
    return b;
  };

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const r = blockRect(col, row);
      const plan = BLOCK_PLAN[row][col];
      const block = { col, row, plan, rect: r };
      blocks.push(block);
      const inset = 16;

      if (plan === 'D' || plan === 'B') {
        // Downtown: two to four towers with a small plaza between them.
        const n = 2 + Math.floor(rng() * 3);
        const spots = [
          [r.x + inset, r.y + inset],
          [r.x + r.w / 2 + 6, r.y + inset],
          [r.x + inset, r.y + r.h / 2 + 6],
          [r.x + r.w / 2 + 6, r.y + r.h / 2 + 6],
        ];
        for (let k = 0; k < n; k++) {
          const [sx, sy] = spots[k];
          const w = 118 + rng() * 26;
          const h = 118 + rng() * 26;
          const name = plan === 'B' && k === 0
            ? 'Banco del Sol'
            : TOWER_NAMES[Math.floor(rng() * TOWER_NAMES.length)];
          addBuilding(sx, sy, w, h, 9 + Math.floor(rng() * 9), name, 'tower');
        }
      } else if (plan === 'S') {
        // Shops: a row of low wide storefronts along the north edge,
        // a couple more along the south, each with its own sign.
        const n = 3 + Math.floor(rng() * 2);
        const wEach = (r.w - inset * 2 - (n - 1) * 8) / n;
        for (let k = 0; k < n; k++) {
          const name = SHOP_NAMES[Math.floor(rng() * SHOP_NAMES.length)];
          addBuilding(r.x + inset + k * (wEach + 8), r.y + inset, wEach, 74, 1 + Math.floor(rng() * 2), name, 'shop');
        }
        for (let k = 0; k < 2; k++) {
          const name = SHOP_NAMES[Math.floor(rng() * SHOP_NAMES.length)];
          addBuilding(r.x + inset + k * 150, r.y + r.h - inset - 70, 138, 70, 1, name, 'shop');
        }
        palms.push({ x: r.x + r.w - 30, y: r.y + r.h - 34, s: 0.9 + rng() * 0.4 });
      } else if (plan === 'H') {
        // Homes: six small houses with pastel roofs.
        for (let k = 0; k < 6; k++) {
          const hx = r.x + inset + (k % 3) * 102;
          const hy = r.y + inset + Math.floor(k / 3) * 152;
          addBuilding(hx, hy, 84, 96, 1, null, 'house');
        }
        trees.push({ x: r.x + r.w - 40, y: r.y + 46, s: 1 });
        trees.push({ x: r.x + 44, y: r.y + r.h - 42, s: 1.1 });
      } else if (plan === 'P') {
        // Park: no buildings, just lawns, palms and trees.
        for (let k = 0; k < 5; k++) {
          palms.push({ x: r.x + 40 + rng() * (r.w - 80), y: r.y + 40 + rng() * (r.h - 80), s: 0.9 + rng() * 0.5 });
          trees.push({ x: r.x + 40 + rng() * (r.w - 80), y: r.y + 40 + rng() * (r.h - 80), s: 0.9 + rng() * 0.5 });
        }
      } else if (plan === 'L') {
        // Parking lot: marked bays, some filled by parked cars.
        for (let k = 0; k < 8; k++) {
          const sx = r.x + 34 + (k % 4) * 74;
          const sy = r.y + 40 + Math.floor(k / 4) * 150;
          parkingSpots.push({ x: sx, y: sy, angle: Math.PI / 2, taken: false });
        }
        palms.push({ x: r.x + r.w - 28, y: r.y + 28, s: 1 });
      } else if (plan === 'G') {
        // Sol's Garage: one wide workshop, the story's home base.
        addBuilding(r.x + inset, r.y + inset, 190, 120, 1, "Sol's Garage", 'garage');
        addBuilding(r.x + inset, r.y + r.h - inset - 84, 120, 84, 1, null, 'house');
        parkingSpots.push({ x: r.x + 240, y: r.y + 70, angle: 0, taken: false });
        parkingSpots.push({ x: r.x + 240, y: r.y + 130, angle: 0, taken: false });
      } else if (plan === 'W') {
        // The harbor warehouse: one long shed and a yard of crates.
        addBuilding(r.x + inset, r.y + inset, r.w - inset * 2, 120, 2, 'Harbor Freight Co.', 'warehouse');
        for (let k = 0; k < 7; k++) {
          crates.push({
            x: r.x + 30 + rng() * (r.w - 90),
            y: r.y + 180 + rng() * 90,
            s: 20 + rng() * 12,
          });
        }
      }
    }
  }

  // Beach palms along the sand and the coast promenade.
  for (let y = 60; y < WORLD_H - 40; y += 90 + rng() * 70) {
    palms.push({ x: LAND_END + 42 + rng() * 30, y, s: 0.95 + rng() * 0.5 });
    if (rng() < 0.6) palms.push({ x: WATER_X - 60 - rng() * 40, y: y + 30, s: 0.9 + rng() * 0.4 });
  }
  // Promenade lamps become palms' neighbours in render; trees on the island.
  for (let k = 0; k < 6; k++) {
    palms.push({ x: ISLAND.x + 40 + rng() * (ISLAND.w - 80), y: ISLAND.y + 40 + rng() * (ISLAND.h - 80), s: 0.9 + rng() * 0.4 });
  }

  // The island safehouse and a small island shop.
  const safehouse = addBuilding(ISLAND.x + 90, ISLAND.y + 90, 150, 110, 2, 'Casa Segura', 'safehouse');
  addBuilding(ISLAND.x + 70, ISLAND.y + ISLAND.h - 150, 110, 84, 1, 'Tienda La Llave', 'shop');
  parkingSpots.push({ x: ISLAND.x + 270, y: ISLAND.y + 130, angle: 0, taken: false });

  // The hospital is the big south-central shop-row block's anchor building.
  const hospital = addBuilding(
    2 * PITCH + ROAD_W + 26, 4 * PITCH + ROAD_W + 196, 200, 92, 3, 'Clínica Solana', 'hospital',
  );

  const landmarks = {
    garage: { x: 1 * PITCH + ROAD_W + 110, y: 3 * PITCH + ROAD_W + 76, name: "Sol's Garage" },
    bank: { x: 3 * PITCH + ROAD_W + 76, y: 2 * PITCH + ROAD_W + 76, name: 'Banco del Sol' },
    hotel: { x: 5 * PITCH + ROAD_W + 170, y: 1 * PITCH + ROAD_W + 170, name: 'Hotel Marisol' },
    harbor: { x: 0 * PITCH + ROAD_W + 150, y: 4 * PITCH + ROAD_W + 230, name: 'Harbor Freight Co.' },
    hospital: { x: hospital.x + 100, y: hospital.y + 46, name: 'Clínica Solana' },
    safehouse: { x: safehouse.x + 75, y: safehouse.y + 55, name: 'Casa Segura — the Key safehouse' },
    cometSpot: { x: 1 * PITCH + ROAD_W + 176, y: 3 * PITCH + ROAD_W + 196, name: 'the Comet' },
  };

  return { buildings, palms, trees, parkingSpots, crates, blocks, landmarks, houseStreets: HOUSE_STREETS };
}

// ---- Geometry and collision helpers -------------------------------------

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed turn from one angle to another, in radians.
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function onBridge(x, y) {
  return y >= BRIDGE_Y && y <= BRIDGE_Y + ROAD_W && x >= LAND_END && x <= ISLAND.x + 6;
}

export function onIsland(x, y) {
  return x >= ISLAND.x && x <= ISLAND.x + ISLAND.w && y >= ISLAND.y && y <= ISLAND.y + ISLAND.h;
}

export function inWater(x, y) {
  if (onBridge(x, y) || onIsland(x, y)) return false;
  return x > WATER_X;
}

export function onLand(x, y) {
  return !inWater(x, y);
}

// Does a circle overlap any building? Returns the building or null.
export function buildingAt(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circular body (anything with x/y) out of every building it
// overlaps and out of the world bounds. Returns true if it hit something.
export function resolveCircle(city, body, r) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = clamp(body.x, b.x, b.x + b.w);
    const ny = clamp(body.y, b.y, b.y + b.h);
    const dx = body.x - nx;
    const dy = body.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        body.x = nx + (dx / d) * r;
        body.y = ny + (dy / d) * r;
      } else {
        // Centre inside the building: push out along the smallest axis.
        const left = body.x - b.x;
        const right = b.x + b.w - body.x;
        const top = body.y - b.y;
        const bottom = b.y + b.h - body.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) body.x = b.x - r;
        else if (m === right) body.x = b.x + b.w + r;
        else if (m === top) body.y = b.y - r;
        else body.y = b.y + b.h + r;
      }
    }
  }
  if (body.x < r) { body.x = r; hit = true; }
  if (body.y < r) { body.y = r; hit = true; }
  if (body.x > WORLD_W - r) { body.x = WORLD_W - r; hit = true; }
  if (body.y > WORLD_H - r) { body.y = WORLD_H - r; hit = true; }
  return hit;
}

// Cast a hitscan ray from (x, y) along angle; returns the distance at
// which it first strikes a building, or maxDist if it flies clear.
export function rayHitBuilding(city, x, y, angle, maxDist) {
  const step = 14;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let px = x;
  let py = y;
  for (let d = step; d < maxDist; d += step) {
    px += dx;
    py += dy;
    if (buildingAt(city, px, py, 2)) return d;
    if (px < 0 || py < 0 || px > WORLD_W || py > WORLD_H) return d;
  }
  return maxDist;
}

// Is the point on a road (asphalt) rather than a block or the beach?
export function onRoad(x, y) {
  if (onBridge(x, y)) return true;
  if (x > LAND_END) return false;
  const mx = x % PITCH;
  const my = y % PITCH;
  return mx < ROAD_W || my < ROAD_W;
}
