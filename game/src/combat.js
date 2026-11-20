// combat.js — the loud part: a hitscan pistol with a tracer and a puff of dust where the
// round lands, damage to cars and people, and the particle system everything else borrows —
// muzzle flash, impact sparks, the smoke of a dying engine, the splash of colour when a
// mission pays out. Particles are pure decoration: they never decide anything.

export function spawnParticles(game, x, y, opts) {
  const { count = 8, color = '#ffd9a0', speed = 120, life = 0.4, size = 3, spread = Math.PI * 2, dir = 0, gravity = 0 } = opts;
  for (let i = 0; i < count; i++) {
    const a = dir + (Math.random() - 0.5) * spread;
    const s = speed * (0.35 + Math.random() * 0.85);
    game.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: life * (0.6 + Math.random() * 0.7), maxLife: life,
      size: size * (0.6 + Math.random() * 0.9),
      color, gravity,
    });
  }
}

export function updateParticles(game, dt) {
  const ps = game.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) { ps.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.gravity || 0) * dt;
    p.vx *= (1 - 1.6 * dt);
    p.vy *= (1 - 1.6 * dt);
  }
  const ts = game.tracers;
  for (let i = ts.length - 1; i >= 0; i--) {
    ts[i].life -= dt;
    if (ts[i].life <= 0) ts.splice(i, 1);
  }
}

// One trigger pull from (ox, oy) along angle. Walks the ray in short steps and stops at the
// first building, car or person it meets. Returns a report the caller turns into heat, sound
// and statistics; the visual tracer is left in game.tracers either way.
export function fireShot(game, ox, oy, angle) {
  const RANGE = 640;
  const step = 8;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let hit = { kind: 'none', x: ox + dx * RANGE, y: oy + dy * RANGE, dist: RANGE };
  outer:
  for (let d = step; d <= RANGE; d += step) {
    const x = ox + dx * d, y = oy + dy * d;
    for (const ped of game.peds) {
      if (ped.dead || ped.state === 'down') continue;
      if (Math.hypot(ped.x - x, ped.y - y) < 13) { hit = { kind: 'ped', ped, x, y, dist: d }; break outer; }
    }
    for (const car of game.cars) {
      if (car.dead) continue;
      if (Math.hypot(car.x - x, car.y - y) < car.type.l * 0.36) { hit = { kind: 'car', car, x, y, dist: d }; break outer; }
    }
    for (const b of game.city.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { hit = { kind: 'building', x, y, dist: d }; break outer; }
    }
    if (game.city.isWater(x, y)) { hit = { kind: 'water', x, y, dist: d }; break outer; }
  }
  game.tracers.push({ x1: ox + dx * 16, y1: oy + dy * 16, x2: hit.x, y2: hit.y, life: 0.07, maxLife: 0.07 });
  spawnParticles(game, ox + dx * 20, oy + dy * 20, { count: 3, color: '#ffe9a8', speed: 60, life: 0.09, size: 4, spread: 0.7, dir: angle });
  if (hit.kind === 'ped') {
    hit.ped.state = 'down';
    hit.ped.downTime = 8;
    hit.ped.dead = true;
    spawnParticles(game, hit.x, hit.y, { count: 10, color: '#c0392b', speed: 130, life: 0.5, size: 3 });
  } else if (hit.kind === 'car') {
    hit.car.health -= 26;
    spawnParticles(game, hit.x, hit.y, { count: 7, color: '#ffd76a', speed: 170, life: 0.3, size: 2.5 });
    if (hit.car.health <= 0 && !hit.car.dead) { hit.car.dead = true; hit.car.speed = 0; hit.wrecked = true; }
  } else if (hit.kind === 'building' || hit.kind === 'water') {
    spawnParticles(game, hit.x, hit.y, { count: 5, color: hit.kind === 'water' ? '#bfe8f5' : '#d8cfb8', speed: 90, life: 0.32, size: 2.5 });
  }
  return hit;
}

// The smoke of a car that is hurt or dead, called now and then by the main loop.
export function spawnSmoke(game, car) {
  spawnParticles(game, car.x + (Math.random() - 0.5) * 16, car.y + (Math.random() - 0.5) * 16, {
    count: 1, color: car.dead ? 'rgba(40,40,44,0.55)' : 'rgba(90,90,96,0.4)',
    speed: 16, life: 1.15, size: car.dead ? 11 : 7, dir: -Math.PI / 2, spread: 0.8,
  });
}

// A little fountain of gold when money lands.
export function spawnPayday(game, x, y) {
  spawnParticles(game, x, y, { count: 22, color: '#ffd94d', speed: 210, life: 0.7, size: 3.5, gravity: 300 });
}
