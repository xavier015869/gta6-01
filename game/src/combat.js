// combat.js — gunfire and effects for Solana Heat.
//
// Shooting is hitscan: a shot travels instantly to the first building,
// car or person along the aim line, leaving a fading tracer, a muzzle
// flash and a burst of impact particles. The particle system here also
// serves the rest of the game — collision sparks, splashes, smoke and
// the floating "+$400" texts that celebrate a payday.

import { rayHitBuilding, dist2 } from './city.js';
import { damagePed, alarmPeds } from './peds.js';
import { damageCar } from './vehicles.js';
import { sfxShot, sfxHit } from './audio.js';

const SHOT_RANGE = 560;
const SHOT_DAMAGE_PED = 34;
const SHOT_DAMAGE_CAR = 7;

export function spawnParticles(G, x, y, opts) {
  const n = opts.n || 8;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (opts.speed || 120) * (0.3 + Math.random() * 0.9);
    const life = (opts.life || 0.5) * (0.6 + Math.random() * 0.8);
    G.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life, maxLife: life,
      color: opts.color || '#ffd76a',
      size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
      drag: opts.drag ?? 2.2,
      grav: opts.grav ?? 0,
    });
  }
}

export function spawnSparks(G, x, y, n = 8) {
  spawnParticles(G, x, y, { n, color: '#ffcf5c', speed: 210, life: 0.4, size: 3 });
  spawnParticles(G, x, y, { n: Math.ceil(n / 2), color: '#ff8a3d', speed: 120, life: 0.55, size: 4 });
}

export function spawnSplash(G, x, y) {
  spawnParticles(G, x, y, { n: 3, color: '#bfe8ff', speed: 90, life: 0.5, size: 4, grav: 160 });
}

export function spawnPuff(G, x, y, color) {
  spawnParticles(G, x, y, { n: 7, color, speed: 70, life: 0.6, size: 5, drag: 3 });
}

export function addFloater(G, x, y, text, color = '#ffe066') {
  G.floaters.push({ x, y, text, color, life: 1.6, maxLife: 1.6 });
}

export function updateFx(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      G.particles.splice(i, 1);
      continue;
    }
    p.vy += (p.grav || 0) * dt;
    const dragF = Math.max(0, 1 - (p.drag || 0) * dt);
    p.vx *= dragF;
    p.vy *= dragF;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = G.tracers.length - 1; i >= 0; i--) {
    G.tracers[i].life -= dt;
    if (G.tracers[i].life <= 0) G.tracers.splice(i, 1);
  }
  for (let i = G.floaters.length - 1; i >= 0; i--) {
    const f = G.floaters[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) G.floaters.splice(i, 1);
  }
}

// Fire the pistol toward the mouse. Returns true if a shot was fired.
export function playerShoot(G) {
  const p = G.player;
  if (p.inCar || p.fireT > 0) return false;
  p.fireT = 0.16;
  const angle = Math.atan2(G.mouseWorld.y - p.y, G.mouseWorld.x - p.x);
  p.angle = angle;
  sfxShot();

  const muzzleX = p.x + Math.cos(angle) * 16;
  const muzzleY = p.y + Math.sin(angle) * 16;
  spawnParticles(G, muzzleX, muzzleY, { n: 3, color: '#ffe9a3', speed: 60, life: 0.12, size: 5 });

  // Find the closest thing the bullet meets: building, car or person.
  let bestDist = rayHitBuilding(G.city, p.x, p.y, angle, SHOT_RANGE);
  let hitPed = null;
  let hitCar = null;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const along = (e) => (e.x - p.x) * dx + (e.y - p.y) * dy;
  const perp = (e) => Math.abs((e.x - p.x) * dy - (e.y - p.y) * dx);

  for (const ped of G.peds) {
    if (ped.dead) continue;
    const a = along(ped);
    if (a > 0 && a < bestDist && perp(ped) < 11) {
      bestDist = a;
      hitPed = ped;
      hitCar = null;
    }
  }
  for (const car of G.cars) {
    const a = along(car);
    if (a > 0 && a < bestDist + 20 && perp(car) < 24) {
      if (a - 20 < bestDist) {
        bestDist = Math.max(10, a - 16);
        hitCar = car;
        hitPed = null;
      }
    }
  }

  const endX = p.x + dx * bestDist;
  const endY = p.y + dy * bestDist;
  G.tracers.push({ x1: muzzleX, y1: muzzleY, x2: endX, y2: endY, life: 0.09, maxLife: 0.09 });

  if (hitPed) {
    damagePed(G, hitPed, SHOT_DAMAGE_PED);
    spawnPuff(G, endX, endY, '#c94f42');
    sfxHit();
    if (hitPed.dead) G.onPedKilled?.(hitPed);
  } else if (hitCar) {
    damageCar(G, hitCar, SHOT_DAMAGE_CAR, endX, endY);
    sfxHit();
    if (hitCar.driver === 'cop') G.onCopCarHit?.(hitCar);
  } else if (bestDist < SHOT_RANGE) {
    spawnPuff(G, endX, endY, '#d8cfc0');
  }

  // Gunfire is loud: people run, and the law takes an interest.
  alarmPeds(G, p.x, p.y, 300);
  G.onCrime?.('shot', p.x, p.y);
  return true;
}
