// peds.js — the people of Port Solana.
//
// Pedestrians stroll the sidewalks around their block, corner to corner,
// sometimes crossing at a corner to the next block. They are not brave:
// gunfire, a car mounting the kerb or a body dropping sends everyone
// within earshot running. Cars that hit them turn it into a crime, which
// the wanted system hears about through G.onPedHit.

import { PITCH, ROAD_W, BLOCK, COLS, ROWS } from './config.js';
import { resolveCircle, dist2, clamp } from './city.js';

const SHIRTS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffee58', '#ab47bc', '#ff7043', '#26a69a', '#ec407a', '#9ccc65', '#ffffff', '#5c6bc0'];
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#6f4e37'];
const PED_TARGET = 44;

let nextPedId = 1;

function sidewalkCorners(col, row) {
  const x0 = col * PITCH + ROAD_W - 12;
  const y0 = row * PITCH + ROAD_W - 12;
  const x1 = (col + 1) * PITCH + 12;
  const y1 = (row + 1) * PITCH + 12;
  return [
    { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
  ];
}

export function makePed(x, y) {
  return {
    id: nextPedId++,
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 0,
    shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
    skin: SKIN[Math.floor(Math.random() * SKIN.length)],
    state: 'walk', // 'walk' | 'flee' | 'down'
    col: 0, row: 0, corner: 0,
    target: null,
    fleeT: 0,
    fleeFrom: null,
    hp: 30,
    dead: false,
    fadeT: 0,
    walkPhase: Math.random() * Math.PI * 2,
  };
}

export function spawnPed(G, nearPlayer) {
  for (let tries = 0; tries < 10; tries++) {
    const col = Math.floor(Math.random() * COLS);
    const row = Math.floor(Math.random() * ROWS);
    const corners = sidewalkCorners(col, row);
    const c = corners[Math.floor(Math.random() * 4)];
    const x = c.x + (Math.random() - 0.5) * 30;
    const y = c.y + (Math.random() - 0.5) * 30;
    if (nearPlayer && dist2(x, y, G.player.x, G.player.y) < 260 * 260) continue;
    const ped = makePed(x, y);
    ped.col = col;
    ped.row = row;
    ped.corner = Math.floor(Math.random() * 4);
    ped.target = corners[ped.corner];
    G.peds.push(ped);
    return ped;
  }
  return null;
}

export function ensurePeds(G) {
  let alive = 0;
  for (const ped of G.peds) if (!ped.dead) alive++;
  while (alive < PED_TARGET) {
    if (!spawnPed(G, true)) break;
    alive++;
  }
}

// Everyone within radius of a scary event runs from it.
export function alarmPeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (dist2(x, y, ped.x, ped.y) < radius * radius) {
      ped.state = 'flee';
      ped.fleeT = 2 + Math.random() * 2.5;
      ped.fleeFrom = { x, y };
    }
  }
}

function moveToward(G, ped, tx, ty, speed, dt) {
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return true;
  const want = Math.atan2(dy, dx);
  ped.angle = want;
  ped.speed = speed;
  ped.x += Math.cos(want) * speed * dt;
  ped.y += Math.sin(want) * speed * dt;
  resolveCircle(G.city, ped, 9);
  return false;
}

function updatePed(G, ped, dt) {
  if (ped.dead) {
    ped.fadeT += dt;
    return;
  }
  ped.walkPhase += dt * (ped.state === 'flee' ? 13 : 7);

  if (ped.state === 'flee') {
    ped.fleeT -= dt;
    const from = ped.fleeFrom || G.player;
    const away = Math.atan2(ped.y - from.y, ped.x - from.x);
    ped.angle = away;
    ped.speed = 205;
    ped.x += Math.cos(away) * ped.speed * dt;
    ped.y += Math.sin(away) * ped.speed * dt;
    resolveCircle(G.city, ped, 9);
    if (ped.fleeT <= 0) {
      ped.state = 'walk';
      // Rejoin the nearest block's sidewalk loop.
      ped.col = clamp(Math.floor(ped.x / PITCH), 0, COLS - 1);
      ped.row = clamp(Math.floor(ped.y / PITCH), 0, ROWS - 1);
      ped.corner = 0;
      ped.target = sidewalkCorners(ped.col, ped.row)[0];
    }
    return;
  }

  // Strolling: head for the current corner, then take the next one —
  // or, now and then, cross the road to the neighbouring block.
  if (!ped.target) ped.target = sidewalkCorners(ped.col, ped.row)[ped.corner];
  if (moveToward(G, ped, ped.target.x, ped.target.y, 62, dt)) {
    if (Math.random() < 0.18) {
      const dirs = [];
      if (ped.col > 0) dirs.push([-1, 0]);
      if (ped.col < COLS - 1) dirs.push([1, 0]);
      if (ped.row > 0) dirs.push([0, -1]);
      if (ped.row < ROWS - 1) dirs.push([0, 1]);
      if (dirs.length) {
        const [dc, dr] = dirs[Math.floor(Math.random() * dirs.length)];
        ped.col += dc;
        ped.row += dr;
        ped.corner = Math.floor(Math.random() * 4);
        ped.target = sidewalkCorners(ped.col, ped.row)[ped.corner];
        return;
      }
    }
    ped.corner = (ped.corner + 1) % 4;
    ped.target = sidewalkCorners(ped.col, ped.row)[ped.corner];
  }
}

// Cars versus people: a slow nudge makes a pedestrian dive away, a fast
// one is a hit-and-run — and the wanted system finds out.
function updatePedCarContacts(G) {
  for (const ped of G.peds) {
    if (ped.dead) continue;
    for (const car of G.cars) {
      if (car.dead || Math.abs(car.speed) < 12) continue;
      if (dist2(ped.x, ped.y, car.x, car.y) < 26 * 26) {
        if (Math.abs(car.speed) > 130) {
          ped.hp = 0;
          ped.dead = true;
          ped.state = 'down';
          if (G.onPedHit) G.onPedHit(ped, car);
        } else {
          ped.state = 'flee';
          ped.fleeT = 1.6;
          ped.fleeFrom = { x: car.x, y: car.y };
        }
        break;
      }
    }
  }
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) updatePed(G, ped, dt);
  updatePedCarContacts(G);
  // Bodies fade; distant strollers are recycled near the player.
  const p = G.player;
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    if (ped.dead && ped.fadeT > 24) G.peds.splice(i, 1);
    else if (!ped.dead && dist2(ped.x, ped.y, p.x, p.y) > 1600 * 1600) G.peds.splice(i, 1);
  }
  ensurePeds(G);
}

export function damagePed(G, ped, amount) {
  if (ped.dead) return;
  ped.hp -= amount;
  if (ped.hp <= 0) {
    ped.dead = true;
    ped.state = 'down';
  } else {
    ped.state = 'flee';
    ped.fleeT = 3;
    ped.fleeFrom = { x: G.player.x, y: G.player.y };
  }
}
