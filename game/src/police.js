// police.js — the Port Solana Police Department: the wanted system and
// the Interceptors that answer it.
//
// Crimes add "heat" measured in fractions of a star. While any officer
// can see the player the heat holds; break away and stay unseen and it
// drains, faster at the island safehouse. Police spawn on roads out of
// sight, steer straight for the player (routing over the bridge when the
// chase crosses to Solana Key), ram, and try to keep the player pinned
// long enough to fill the bust meter.

import { WORLD_W, LAND_END, ISLAND, BRIDGE_Y, ROAD_W } from './config.js';
import { vRoadCenter, hRoadCenter, resolveCircle, clamp, angleDelta, dist2 } from './city.js';
import { makeCar } from './vehicles.js';

export const CRIME_HEAT = {
  shot: 0.55,
  pedHit: 0.9,
  pedKilled: 1.5,
  carjack: 0.8,
  copCarHit: 1.0,
  crash: 0.2,
  robbery: 3.0,
  missionHeat: 2.0,
};

const COPS_BY_STARS = [0, 1, 2, 3, 5, 6];
const BRIDGE_MID = { x: (LAND_END + ISLAND.x) / 2, y: BRIDGE_Y + ROAD_W / 2 };

export function starsOf(G) {
  return clamp(Math.floor(G.wanted.heat + 0.5), 0, 5);
}

export function addHeat(G, amount) {
  G.wanted.heat = clamp(G.wanted.heat + amount, 0, 5.6);
  if (amount > 0) G.wanted.lastCrimeT = G.time;
}

function playerPos(G) {
  return G.player.inCar || G.player;
}

function copSpawnPoint(G) {
  const p = playerPos(G);
  const options = [];
  for (let i = 0; i <= 7; i++) {
    for (let j = 0; j <= 5; j++) {
      const x = vRoadCenter(i);
      const y = hRoadCenter(j);
      const d = Math.hypot(x - p.x, y - p.y);
      if (d > 600 && d < 1050) options.push({ x, y });
    }
  }
  if (!options.length) options.push({ x: vRoadCenter(0), y: hRoadCenter(0) });
  return options[Math.floor(Math.random() * options.length)];
}

function spawnCop(G) {
  const spot = copSpawnPoint(G);
  const cop = makeCar('cop', spot.x, spot.y, Math.random() * Math.PI * 2, 'cop');
  cop.ai = { stuckT: 0, reverseT: 0, sirenPhase: Math.random() * Math.PI * 2 };
  G.cars.push(cop);
  G.cops.push(cop);
  return cop;
}

// Where a cop should aim: the player, unless the chase has to cross the
// water — then the bridge is the only way, so head for its middle first.
function pursuitTarget(G, cop) {
  const p = playerPos(G);
  const copEast = cop.x > LAND_END;
  const playerEast = p.x > LAND_END;
  if (copEast !== playerEast) return BRIDGE_MID;
  return p;
}

function updateCop(G, cop, dt) {
  if (cop.dead) return;
  const target = pursuitTarget(G, cop);
  const dx = target.x - cop.x;
  const dy = target.y - cop.y;
  const dist = Math.hypot(dx, dy);
  const ai = cop.ai;

  if (ai.reverseT > 0) {
    ai.reverseT -= dt;
    cop.speed = Math.max(cop.speed - 300 * dt, -120);
  } else {
    const want = Math.atan2(dy, dx);
    const delta = angleDelta(cop.angle, want);
    cop.angle += clamp(delta, -2.9 * dt, 2.9 * dt);
    cop.steerVis = clamp(delta * 2, -1, 1);
    const goal = dist > 210 ? cop.type.top : dist > 90 ? cop.type.top * 0.72 : cop.type.top * 0.5;
    cop.speed += clamp(goal - cop.speed, -340 * dt, cop.type.accel * dt);
    if (Math.abs(cop.speed) < 22 && dist > 60) {
      ai.stuckT += dt;
      if (ai.stuckT > 0.9) {
        ai.reverseT = 0.75;
        ai.stuckT = 0;
        cop.angle += 0.6; // break the deadlock with the wall
      }
    } else {
      ai.stuckT = 0;
    }
  }

  cop.x += Math.cos(cop.angle) * cop.speed * dt;
  cop.y += Math.sin(cop.angle) * cop.speed * dt;
  if (resolveCircle(G.city, cop, 19)) cop.speed *= -0.25;
}

export function updatePolice(G, dt) {
  const w = G.wanted;
  const p = playerPos(G);
  const stars = starsOf(G);

  // Sight: any living officer within range keeps the heat on.
  let nearestCop = Infinity;
  for (const cop of G.cops) {
    if (cop.dead) continue;
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < nearestCop) nearestCop = d;
  }
  w.seenNow = nearestCop < 640;
  if (w.seenNow) w.lastSeenT = G.time;

  // Heat drains while unseen — slowly in the city, fast at the safehouse.
  if (G.time - w.lastSeenT > 3.5 && w.heat > 0) {
    const atSafehouse = p.x > LAND_END;
    const rate = atSafehouse && nearestCop > 320 ? 0.34 : 0.055;
    w.heat = Math.max(0, w.heat - rate * dt);
  }

  // Reinforcements arrive out of sight until the star count is answered.
  w.spawnT -= dt;
  const wanted = COPS_BY_STARS[stars];
  const active = G.cops.filter((c) => !c.dead).length;
  if (stars > 0 && active < wanted && w.spawnT <= 0) {
    spawnCop(G);
    w.spawnT = 1.4;
  }

  for (const cop of G.cops) updateCop(G, cop, dt);

  // Officers give up and drift away once the heat is fully gone.
  if (stars === 0) {
    for (let i = G.cops.length - 1; i >= 0; i--) {
      const cop = G.cops[i];
      if (Math.hypot(cop.x - p.x, cop.y - p.y) > 560) {
        G.cars.splice(G.cars.indexOf(cop), 1);
        G.cops.splice(i, 1);
      }
    }
  }

  updateBustMeter(G, dt, nearestCop);
}

// The bust meter: pinned by the police, on foot or in a stopped car,
// and it fills. Fill it and the run ends at the station.
function updateBustMeter(G, dt, nearestCop) {
  const p = G.player;
  let pinned = false;
  if (!p.inCar) {
    pinned = nearestCop < 56 && p.speedNow < 40;
    if (pinned) G.bustT += dt / 1.1;
  } else {
    pinned = nearestCop < 74 && Math.abs(p.inCar.speed) < 16;
    if (pinned) G.bustT += dt / 1.7;
  }
  if (!pinned) G.bustT = Math.max(0, G.bustT - dt * 0.8);
  if (G.bustT >= 1) {
    G.bustT = 0;
    G.onBusted?.();
  }
}
