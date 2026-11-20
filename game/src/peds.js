// peds.js — the people of Port Solana. They stroll the pavements from corner to corner,
// cross at the junctions, and run when the day turns violent: a gunshot, a car mounting the
// kerb, a chase spilling past. A ped is a small state machine — walk, flee, or down — and the
// rest of the game (traffic braking, heat for hit-and-runs, taxi fares) reads that state.

import { PED_COUNT, ROAD_W } from './config.js';

const SHIRTS = ['#e56399', '#39c2d7', '#f7f06d', '#7bc950', '#f2a03d', '#e8e4da', '#b56576', '#98c1d9'];
const PANTS = ['#2f3b4c', '#5d4a36', '#37474f', '#6d4c41', '#263238', '#795548'];

// Every pavement corner in the city: the four corners of every intersection, pushed out to
// where the sidewalk runs. Peds walk corner to corner along the road's edge.
export function sidewalkCorners(city) {
  const off = ROAD_W / 2 + 10;
  const corners = [];
  for (const n of city.nodes) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = n.x + sx * off, y = n.y + sy * off;
      if (!city.isWater(x, y)) corners.push({ x, y });
    }
  }
  return corners;
}

export function makePed(corners, rng, near = null) {
  const home = near || corners[Math.floor(rng() * corners.length)];
  return {
    x: home.x + (rng() - 0.5) * 16,
    y: home.y + (rng() - 0.5) * 16,
    angle: rng() * Math.PI * 2,
    speed: 62 + rng() * 38,
    state: 'walk', // 'walk' | 'flee' | 'down'
    target: null,
    waitTime: 0,
    fleeFrom: null,
    fleeTime: 0,
    downTime: 0,
    dead: false,
    shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
    pants: PANTS[Math.floor(rng() * PANTS.length)],
    skin: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'][Math.floor(rng() * 5)],
    isFare: false,
  };
}

export function createPeds(city, rng) {
  const corners = sidewalkCorners(city);
  const peds = [];
  for (let i = 0; i < PED_COUNT; i++) peds.push(makePed(corners, rng));
  return { peds, corners };
}

function pickTarget(game, ped, rng) {
  // A corner within a stroll's reach, so the walk reads as a route, not a teleport of intent.
  const options = game.corners.filter((c) => {
    const d = Math.hypot(c.x - ped.x, c.y - ped.y);
    return d > 60 && d < 760;
  });
  if (!options.length) return null;
  return options[Math.floor(rng() * options.length)];
}

export function scarePeds(game, x, y, radius) {
  for (const ped of game.peds) {
    if (ped.dead || ped.state === 'down') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee';
      ped.fleeFrom = { x, y };
      ped.fleeTime = 2 + Math.random() * 2;
    }
  }
}

export function updatePed(game, ped, dt, rng) {
  if (ped.dead) return;
  if (ped.state === 'down') {
    ped.downTime -= dt;
    if (ped.downTime <= 0 && !ped.dead) { ped.state = 'walk'; ped.target = null; }
    return;
  }
  let speed = ped.speed;
  let moveAngle = ped.angle;
  if (ped.state === 'flee') {
    ped.fleeTime -= dt;
    if (ped.fleeTime <= 0 || !ped.fleeFrom) { ped.state = 'walk'; ped.target = null; }
    else {
      moveAngle = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
      speed = 265;
    }
  }
  if (ped.state === 'walk') {
    if (ped.waitTime > 0) { ped.waitTime -= dt; return; }
    if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 14) {
      if (ped.target && rng() < 0.3) ped.waitTime = 0.6 + rng() * 2.4; // pause, check a phone, look at the sea
      ped.target = pickTarget(game, ped, rng);
      if (!ped.target) return;
    }
    moveAngle = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
  }
  // Smooth facing, then a step that slides along walls and stops at the water's edge.
  let d = moveAngle - ped.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  ped.angle += d * Math.min(1, dt * 10);
  const pos = { x: ped.x, y: ped.y };
  const hit = game.city.moveCircle(pos, Math.cos(ped.angle) * speed * dt, Math.sin(ped.angle) * speed * dt, 9);
  ped.x = pos.x; ped.y = pos.y;
  if (hit && ped.state === 'walk') ped.target = null; // bumped into the city: choose a new way
  if (hit && ped.state === 'flee') { ped.fleeTime = Math.min(ped.fleeTime, 0.4); }
}

// A car meeting a person. Returns 'killed' | 'injured' | null for the caller's heat and sound.
export function carHitsPed(car, ped) {
  if (ped.dead || ped.state === 'down') return null;
  const rr = 30;
  if (Math.hypot(car.x - ped.x, car.y - ped.y) > rr) return null;
  const speed = Math.abs(car.speed);
  if (speed < 46) { // a nudge at walking pace: the ped stumbles clear and shouts
    ped.state = 'flee'; ped.fleeFrom = { x: car.x, y: car.y }; ped.fleeTime = 1.2;
    return null;
  }
  ped.state = 'down';
  ped.downTime = 6;
  if (speed > 250) { ped.dead = true; return 'killed'; }
  return 'injured';
}
