// vehicles.js — every car in Port Solana: the factory, the parked cars,
// the traffic that drives the grid, and the player's driving physics.
//
// Traffic follows the road grid lane by lane with right-hand traffic:
// each car travels along one road toward the next intersection, then
// turns or carries on. Cars slow for whatever is ahead of them — other
// cars, the player, pedestrians — which makes the city feel inhabited
// rather than choreographed.

import { CAR_TYPES, ROAD_W, LAND_END } from './config.js';
import {
  vRoadCenter, hRoadCenter, resolveCircle, inWater, clamp, angleDelta, dist2,
} from './city.js';
import { sfxCrash } from './audio.js';

const LANE = 26; // lane offset from a road's centre line
const TRAFFIC_TARGET = 24;

let nextCarId = 1;

export function makeCar(typeKey, x, y, angle, driver) {
  const type = CAR_TYPES[typeKey];
  const color = type.colors[Math.floor(Math.random() * type.colors.length)];
  return {
    id: nextCarId++,
    typeKey, type, color,
    x, y, angle,
    speed: 0,
    health: 100,
    driver: driver || 'parked', // 'parked' | 'traffic' | 'player' | 'cop'
    dead: false,
    ai: null,
    steerVis: 0,
    honkT: 0,
  };
}

// Fill the parking lots and line a few kerbs with parked, stealable cars.
export function spawnParkedCars(G) {
  const kinds = ['sedan', 'hatch', 'truck', 'comet', 'taxi'];
  for (const spot of G.city.parkingSpots) {
    if (Math.random() < 0.28) continue;
    spot.taken = true;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    G.cars.push(makeCar(kind, spot.x, spot.y, spot.angle, 'parked'));
  }
  // Kerbside cars along a few vertical roads.
  for (let k = 0; k < 14; k++) {
    const i = Math.floor(Math.random() * 7);
    const x = i * 420 + (Math.random() < 0.5 ? 16 : ROAD_W - 16);
    const y = 200 + Math.random() * 1800;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    G.cars.push(makeCar(kind, x, y, Math.PI / 2, 'parked'));
  }
}

// A traffic car starts on a random intersection heading somewhere legal.
export function spawnTrafficCar(G, farFrom) {
  for (let tries = 0; tries < 12; tries++) {
    const i = Math.floor(Math.random() * 8);
    const j = Math.floor(Math.random() * 6);
    const x = vRoadCenter(i);
    const y = hRoadCenter(j);
    if (farFrom && dist2(x, y, farFrom.x, farFrom.y) < 500 * 500) continue;
    const horizontal = Math.random() < 0.5;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const kinds = ['sedan', 'hatch', 'taxi', 'truck', 'comet'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const car = makeCar(kind, x, y, 0, 'traffic');
    car.ai = { axis: horizontal ? 'h' : 'v', dir, i, j, cruise: 0.45 + Math.random() * 0.25 };
    snapToLane(car);
    car.speed = car.type.top * car.ai.cruise * 0.8;
    G.cars.push(car);
    return car;
  }
  return null;
}

export function ensureTraffic(G) {
  let count = 0;
  for (const car of G.cars) if (car.driver === 'traffic' && !car.dead) count++;
  while (count < TRAFFIC_TARGET) {
    if (!spawnTrafficCar(G, G.player)) break;
    count++;
  }
}

// Put a traffic car exactly in its lane for its current heading.
function snapToLane(car) {
  const ai = car.ai;
  if (ai.axis === 'h') {
    car.y = hRoadCenter(ai.j) + (ai.dir > 0 ? LANE : -LANE);
    car.angle = ai.dir > 0 ? 0 : Math.PI;
  } else {
    car.x = vRoadCenter(ai.i) + (ai.dir > 0 ? -LANE : LANE);
    car.angle = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}

// The point a traffic car is currently driving toward: the next
// intersection along its road, in its lane.
function trafficTarget(car) {
  const ai = car.ai;
  if (ai.axis === 'h') {
    const nextI = ai.dir > 0 ? ai.i + 1 : ai.i - 1;
    return { x: vRoadCenter(nextI), y: hRoadCenter(ai.j) + (ai.dir > 0 ? LANE : -LANE), nextI };
  }
  const nextJ = ai.dir > 0 ? ai.j + 1 : ai.j - 1;
  return { x: vRoadCenter(ai.i) + (ai.dir > 0 ? -LANE : LANE), y: hRoadCenter(nextJ), nextJ };
}

// At an intersection, choose the way onward: mostly straight, sometimes
// a turn, never off the edge of the grid and never a U-turn.
function chooseOnward(car) {
  const ai = car.ai;
  const options = [];
  if (ai.axis === 'h') {
    const nextI = ai.dir > 0 ? ai.i + 1 : ai.i - 1;
    if (nextI >= 0 && nextI <= 7) options.push({ axis: 'h', dir: ai.dir, i: nextI, j: ai.j, w: 5 });
    if (ai.j > 0) options.push({ axis: 'v', dir: -1, i: nextI, j: ai.j, w: 2 });
    if (ai.j < 5) options.push({ axis: 'v', dir: 1, i: nextI, j: ai.j, w: 2 });
    pickOption(car, options, nextI, ai.j);
  } else {
    const nextJ = ai.dir > 0 ? ai.j + 1 : ai.j - 1;
    if (nextJ >= 0 && nextJ <= 5) options.push({ axis: 'v', dir: ai.dir, i: ai.i, j: nextJ, w: 5 });
    if (ai.i > 0) options.push({ axis: 'h', dir: -1, i: ai.i, j: nextJ, w: 2 });
    if (ai.i < 7) options.push({ axis: 'h', dir: 1, i: ai.i, j: nextJ, w: 2 });
    pickOption(car, options, ai.i, nextJ);
  }
}

function pickOption(car, options, ci, cj) {
  const ai = car.ai;
  ai.i = ci;
  ai.j = cj;
  if (!options.length) {
    // Dead end of the grid (should not happen): turn around.
    ai.dir = -ai.dir;
    snapToLane(car);
    return;
  }
  let total = 0;
  for (const o of options) total += o.w;
  let roll = Math.random() * total;
  let chosen = options[0];
  for (const o of options) {
    roll -= o.w;
    if (roll <= 0) { chosen = o; break; }
  }
  ai.axis = chosen.axis;
  ai.dir = chosen.dir;
  ai.i = chosen.i;
  ai.j = chosen.j;
}

// ---- Per-frame updates ---------------------------------------------------

// Something solid ahead of a traffic car? Other cars and pedestrians
// count; the check point sits one car-length in front of the nose.
function blockedAhead(G, car) {
  const hx = car.x + Math.cos(car.angle) * 50;
  const hy = car.y + Math.sin(car.angle) * 50;
  for (const other of G.cars) {
    if (other === car) continue;
    if (dist2(hx, hy, other.x, other.y) < 30 * 30) return true;
  }
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (dist2(hx, hy, ped.x, ped.y) < 26 * 26) return true;
  }
  const p = G.player;
  if (!p.inCar && dist2(hx, hy, p.x, p.y) < 26 * 26) return true;
  return false;
}

function updateTrafficCar(G, car, dt) {
  const ai = car.ai;
  const target = trafficTarget(car);
  let arrived = false;
  if (ai.axis === 'h') {
    arrived = ai.dir > 0 ? car.x >= target.x - 8 : car.x <= target.x + 8;
  } else {
    arrived = ai.dir > 0 ? car.y >= target.y - 8 : car.y <= target.y + 8;
  }
  if (arrived) chooseOnward(car);

  // Steer toward a point far ahead in the current lane.
  let tx;
  let ty;
  if (car.ai.axis === 'h') {
    tx = car.x + car.ai.dir * 600;
    ty = hRoadCenter(car.ai.j) + (car.ai.dir > 0 ? LANE : -LANE);
  } else {
    tx = vRoadCenter(car.ai.i) + (car.ai.dir > 0 ? -LANE : LANE);
    ty = car.y + car.ai.dir * 600;
  }
  const want = Math.atan2(ty - car.y, tx - car.x);
  const delta = angleDelta(car.angle, want);
  car.angle += clamp(delta, -2.4 * dt, 2.4 * dt);
  car.steerVis = clamp(delta * 2, -1, 1);

  const cruise = car.type.top * ai.cruise;
  const goal = blockedAhead(G, car) ? 0 : cruise;
  const rate = goal > car.speed ? car.type.accel * 0.55 : 320;
  car.speed += clamp(goal - car.speed, -rate * dt, rate * dt);

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (resolveCircle(G.city, car, 19)) car.speed *= 0.35;
}

// The player's car: arcade physics with weight, drift and consequences.
export function updatePlayerCar(G, dt, control) {
  const car = G.player.inCar;
  if (!car) return;
  const t = car.type;

  if (control.throttle > 0) car.speed += t.accel * control.throttle * dt;
  if (control.throttle < 0) {
    // Brake, then reverse.
    car.speed += (car.speed > 4 ? -380 : t.accel * 0.55 * control.throttle) * dt;
  }
  // Rolling drag and engine braking.
  car.speed -= car.speed * 0.5 * dt;
  if (control.throttle === 0) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 46 * dt);
  }
  if (control.handbrake) car.speed -= car.speed * 2.4 * dt;
  car.speed = clamp(car.speed, -105, t.top);

  const speedFactor = clamp(Math.abs(car.speed) / 130, 0, 1);
  if (Math.abs(car.speed) > 2) {
    const dirSign = car.speed < 0 ? -1 : 1;
    const turn = control.steer * t.grip * speedFactor * dirSign;
    car.angle += turn * dt * (control.handbrake ? 1.35 : 1);
  }
  car.steerVis = control.steer;

  const before = Math.abs(car.speed);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (resolveCircle(G.city, car, 19)) {
    if (before > 110) {
      const impact = before - 110;
      damageCar(G, car, impact * 0.10, car.x, car.y);
      if (before > 250) G.player.health -= (before - 250) * 0.03;
      sfxCrash(clamp(impact / 200, 0.2, 1.4));
      G.shake = Math.min(9, impact * 0.03);
    }
    car.speed = -car.speed * 0.22;
  }
}

export function damageCar(G, car, amount, x, y) {
  if (car.dead) return;
  car.health -= amount;
  if (G.spawnSparks) G.spawnSparks(x, y, Math.min(10, 3 + amount * 0.2));
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    car.speed = 0;
  }
}

// Bump cars into each other: circles trading momentum and paint.
export function updateCarCollisions(G) {
  const cars = G.cars;
  for (let a = 0; a < cars.length; a++) {
    for (let b = a + 1; b < cars.length; b++) {
      const A = cars[a];
      const B = cars[b];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d2 = dx * dx + dy * dy;
      const min = 40;
      if (d2 > min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = (min - d) / 2;
      A.x -= nx * overlap;
      A.y -= ny * overlap;
      B.x += nx * overlap;
      B.y += ny * overlap;
      const rel = Math.abs(A.speed - B.speed) + Math.abs(A.speed) * 0.2;
      if (rel > 55) {
        damageCar(G, A, rel * 0.05, A.x, A.y);
        damageCar(G, B, rel * 0.05, B.x, B.y);
        if (A.driver === 'player' || B.driver === 'player') {
          sfxCrash(clamp(rel / 220, 0.2, 1.2));
          G.shake = Math.min(8, rel * 0.03);
          G.onPlayerCrash?.(Math.max(A.speed, B.speed));
        }
      }
      const swap = (A.speed + B.speed) / 2;
      if (A.driver !== 'parked') A.speed = swap * 0.7;
      if (B.driver !== 'parked') B.speed = swap * 0.7;
    }
  }
}

// Water is bad for cars and worse for the person inside them.
function updateWater(G, car, dt) {
  if (!inWater(car.x, car.y)) return;
  car.speed -= car.speed * 2.6 * dt;
  damageCar(G, car, 26 * dt, car.x, car.y);
  if (car.driver === 'player') {
    G.player.health -= 7 * dt;
    if (G.spawnSplash) G.spawnSplash(car.x, car.y);
  }
}

export function updateVehicles(G, dt) {
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
    updateWater(G, car, dt);
  }
  // Recycle traffic that has wandered far from the player.
  const p = G.player;
  for (let i = G.cars.length - 1; i >= 0; i--) {
    const car = G.cars[i];
    if (car.driver === 'traffic' && dist2(car.x, car.y, p.x, p.y) > 1500 * 1500) {
      G.cars.splice(i, 1);
    }
  }
  ensureTraffic(G);
}

export function nearestCar(G, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of G.cars) {
    if (car.driver === 'cop' || car.dead) continue;
    const d = dist2(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
