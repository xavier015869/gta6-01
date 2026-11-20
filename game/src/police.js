// police.js — the PSPD and the heat they bring. Heat is a fractional score the player's
// crimes feed and hiding starves; its ceiling is the star count on the HUD. Interceptors
// spawn out of sight on the road graph, hunt by steering for where the player is heading,
// and win not by shooting but by pinning the player still until the bust meter fills.

import { HEAT, MAX_HEAT } from './config.js';
import { makeCar, stepCar } from './vehicles.js';

export function createWanted() {
  return {
    heat: 0,
    bust: 0, // 0..1, fills while the player is held near an officer
    hiddenTime: 0, // seconds since an officer last had the player in reach
    seen: false,
  };
}

export function starsOf(heat) {
  return heat <= 0 ? 0 : Math.min(5, Math.ceil(heat));
}

// How many interceptors the PSPD fields at each star level.
const FIELD_STRENGTH = [0, 1, 2, 3, 5, 6];

// A crime feeds the heat. A witnessed crime — an officer or a bystander close enough to
// tell the story — feeds it in full; an unseen one only leaks in, a rumour of a crime.
export function addHeat(game, amount, witnessX, witnessY) {
  const w = game.wanted;
  let witnessed = false;
  for (const car of game.cars) {
    if (car.driver === 'police' && Math.hypot(car.x - witnessX, car.y - witnessY) < 720) witnessed = true;
  }
  if (!witnessed) {
    for (const ped of game.peds) {
      if (!ped.dead && ped.state !== 'down' && Math.hypot(ped.x - witnessX, ped.y - witnessY) < 250) { witnessed = true; break; }
    }
  }
  w.heat = Math.min(MAX_HEAT, w.heat + amount * (witnessed ? 1 : 0.4));
  if (witnessed) w.hiddenTime = 0;
  return witnessed;
}

function spawnInterceptor(game, rng) {
  const p = game.playerPos();
  let best = null, bestScore = -Infinity;
  for (let tries = 0; tries < 24; tries++) {
    const node = game.city.nodes[Math.floor(rng() * game.city.nodes.length)];
    const d = Math.hypot(node.x - p.x, node.y - p.y);
    if (d < 640 || d > 1250) continue;
    // Score by distance band: close enough to matter, far enough to be out of sight.
    const score = 1000 - Math.abs(d - 880) + rng() * 120;
    if (score > bestScore) { bestScore = score; best = node; }
  }
  if (!best) return null;
  const car = makeCar(game.city, 'interceptor', best.x, best.y, rng() * Math.PI * 2, 'police', rng);
  game.cars.push(car);
  return car;
}

export function updatePolice(game, dt, rng) {
  const w = game.wanted;
  const stars = starsOf(w.heat);
  const p = game.playerPos();
  const police = game.cars.filter((c) => c.driver === 'police');

  // Eyes on the player: any living interceptor within reach resets the hiding clock.
  w.seen = police.some((c) => !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 660);
  if (w.seen) w.hiddenTime = 0; else w.hiddenTime += dt;

  // Heat drains while hidden — slowly on the street, fast in the island safehouse.
  if (w.heat > 0 && w.hiddenTime > 2.2) {
    const atSafehouse = game.playerAtSafehouse();
    const rate = atSafehouse ? HEAT.safehouseDecayPerSecond : HEAT.decayPerSecond;
    w.heat = Math.max(0, w.heat - rate * dt);
  }

  // Field the right number of units; stand down the far ones when the heat dies.
  const want = FIELD_STRENGTH[starsOf(w.heat)];
  const alive = police.filter((c) => !c.dead);
  if (alive.length < want) {
    game.policeSpawnTimer = (game.policeSpawnTimer || 0) - dt;
    if (game.policeSpawnTimer <= 0) {
      if (spawnInterceptor(game, rng)) game.policeSpawnTimer = 1.6;
      else game.policeSpawnTimer = 0.7;
    }
  }
  for (const car of police) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if ((w.heat <= 0 && d > 500) || d > 2100) {
      game.cars.splice(game.cars.indexOf(car), 1); // called away to another shout
    }
  }

  // Drive the hunt.
  const pv = game.playerVelocity();
  for (const car of police) {
    if (car.dead) continue;
    // Aim where the player is going, not where they are: it cuts corners off a chase.
    const lead = stars >= 3 ? 0.38 : 0.2;
    const tx = p.x + pv.x * lead, ty = p.y + pv.y * lead;
    const dist = Math.hypot(tx - car.x, ty - car.y);
    const desiredAngle = Math.atan2(ty - car.y, tx - car.x);
    let dA = desiredAngle - car.angle;
    while (dA > Math.PI) dA -= Math.PI * 2;
    while (dA < -Math.PI) dA += Math.PI * 2;
    car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, dA * 4 * dt));
    const aggression = 0.8 + starsOf(w.heat) * 0.05;
    let wantSpeed = car.type.topSpeed * aggression;
    if (dist < 120) wantSpeed = Math.min(wantSpeed, 240 + dist); // pull up alongside, don't orbit
    if (game.player.state === 'foot' && dist < 90) wantSpeed = 0; // on foot: stop and make the arrest
    if (car.speed < wantSpeed) car.speed = Math.min(wantSpeed, car.speed + car.type.accel * dt);
    else car.speed = Math.max(wantSpeed, car.speed - 700 * dt);
    const impact = stepCar(game, car, dt);
    if (impact > 300) car.health -= (impact - 280) * 0.05; // walls are not the enemy, but they cost
  }

  // The bust meter: held still near an officer, on foot or in a pinned car, and it fills.
  const playerSpeed = Math.hypot(pv.x, pv.y);
  const heldNear = alive.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < (game.player.state === 'foot' ? 86 : 118));
  if (stars > 0 && heldNear && playerSpeed < 42) {
    w.bust = Math.min(1, w.bust + dt / 2.1);
  } else {
    w.bust = Math.max(0, w.bust - dt / 1.4);
  }
}
