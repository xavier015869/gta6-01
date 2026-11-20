// vehicles.js — every car in Port Solana: the shared body (an arcade car with a heading, a
// speed and a health pool), the traffic mind that drives the road graph from intersection to
// intersection keeping right, and the physics step the player drives with. Police cars are
// bodies from here too; their mind lives in police.js.

import { CAR_TYPES, TRAFFIC_TYPES, TRAFFIC_COUNT, PARKED_COUNT, LANE_OFF } from './config.js';

let nextCarId = 1;

export function makeCar(city, typeKey, x, y, angle, driver, rng) {
  const type = CAR_TYPES[typeKey];
  return {
    id: nextCarId++,
    typeKey, type,
    x, y, angle,
    speed: 0,
    health: type.health,
    color: type.colors[Math.floor(rng() * type.colors.length)],
    driver, // 'traffic' | 'parked' | 'police' | 'player' | null (driverless, e.g. player's old ride)
    dead: false,
    // Traffic navigation: drive the lane toward nodeTo, then choose onward.
    nodeFrom: null, nodeTo: null,
    stuckTime: 0,
    honk: 0,
  };
}

export function carRadius(car) {
  return car.type.l * 0.34;
}

// The point of a road node as seen from a car arriving along direction (dx, dy): the centre of
// the right-hand lane, so two-way traffic passes without touching.
export function lanePoint(node, dx, dy) {
  return { x: node.x - dy * LANE_OFF, y: node.y + dx * LANE_OFF };
}

function pickNextNode(city, car, rng) {
  const options = car.nodeTo.neighbors.filter((n) => n !== car.nodeFrom);
  if (options.length === 0) return car.nodeFrom; // dead end (the bridge ends qualify): turn back
  // Prefer carrying straight on — it reads as intent, not wandering.
  const straight = options.find((n) => Math.sign(n.x - car.nodeTo.x) === Math.sign(car.nodeTo.x - car.nodeFrom.x)
    && Math.sign(n.y - car.nodeTo.y) === Math.sign(car.nodeTo.y - car.nodeFrom.y));
  if (straight && rng() < 0.62) return straight;
  return options[Math.floor(rng() * options.length)];
}

export function sendCarTo(car, fromNode, toNode) {
  car.nodeFrom = fromNode;
  car.nodeTo = toNode;
}

// Spawn the ambient traffic: each car starts on a random road segment, already rolling.
export function createTraffic(city, rng) {
  const cars = [];
  let guard = 0;
  while (cars.length < TRAFFIC_COUNT && guard++ < 400) {
    const from = city.nodes[Math.floor(rng() * city.nodes.length)];
    if (!from.neighbors.length) continue;
    const to = from.neighbors[Math.floor(rng() * from.neighbors.length)];
    const dx = Math.sign(to.x - from.x), dy = Math.sign(to.y - from.y);
    const start = lanePoint(from, dx, dy);
    const t = 0.25 + rng() * 0.5;
    const car = makeCar(city, TRAFFIC_TYPES[Math.floor(rng() * TRAFFIC_TYPES.length)],
      start.x + (to.x - from.x) * t, start.y + (to.y - from.y) * t,
      Math.atan2(dy, dx), 'traffic', rng);
    sendCarTo(car, from, to);
    car.speed = car.type.topSpeed * 0.3;
    if (cars.some((c) => Math.hypot(c.x - car.x, c.y - car.y) < 110)) continue;
    cars.push(car);
  }
  return cars;
}

// Parked cars fill the lots' bays first, then kerbs along the boulevard.
export function createParked(city, rng) {
  const cars = [];
  const spots = [];
  for (const lot of city.lots) for (const s of lot.spots) spots.push(s);
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  for (const spot of spots) {
    if (cars.length >= PARKED_COUNT) break;
    if (rng() < 0.25) continue; // some bays stay empty
    const car = makeCar(city, TRAFFIC_TYPES[Math.floor(rng() * TRAFFIC_TYPES.length)], spot.x, spot.y, spot.angle, 'parked', rng);
    cars.push(car);
  }
  return cars;
}

function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

// Is something solid in this car's near future? Returns the speed it should match, or null.
function obstacleAhead(game, car, lookDist) {
  const hx = Math.cos(car.angle), hy = Math.sin(car.angle);
  const px = car.x + hx * lookDist, py = car.y + hy * lookDist;
  let limit = null;
  for (const other of game.cars) {
    if (other === car || other.dead) continue;
    const d = Math.hypot(other.x - px, other.y - py);
    if (d < carRadius(other) + 26) {
      const s = Math.abs(other.speed);
      limit = limit === null ? s : Math.min(limit, s);
    }
  }
  for (const ped of game.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - px, ped.y - py) < 30) limit = 0;
  }
  const p = game.player;
  if (p.car && p.car !== car && Math.hypot(p.car.x - px, p.car.y - py) < carRadius(p.car) + 26) {
    limit = limit === null ? Math.abs(p.car.speed) : Math.min(limit, Math.abs(p.car.speed));
  }
  return limit;
}

// One traffic car's tick: follow its lane, mind the car in front, turn at the junction.
export function updateTrafficCar(game, car, dt, rng) {
  if (car.dead || car.driver !== 'traffic') return;
  const dx = Math.sign(car.nodeTo.x - car.nodeFrom.x), dy = Math.sign(car.nodeTo.y - car.nodeFrom.y);
  const target = lanePoint(car.nodeTo, dx, dy);
  const distToNode = Math.hypot(target.x - car.x, target.y - car.y);
  if (distToNode < 42) {
    const next = pickNextNode(game.city, car, rng);
    sendCarTo(car, car.nodeTo, next);
    return;
  }
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  car.angle = angleLerp(car.angle, desired, dt * 3.2);
  const cruise = car.type.topSpeed * 0.42;
  const limit = obstacleAhead(game, car, 58 + Math.abs(car.speed) * 0.22);
  let want = cruise;
  if (limit !== null) want = Math.min(want, limit * 0.92);
  if (car.speed < want) car.speed = Math.min(want, car.speed + car.type.accel * 0.55 * dt);
  else car.speed = Math.max(want, car.speed - 620 * dt);
  if (Math.abs(car.speed) < 4 && limit !== null) { car.stuckTime += dt; } else car.stuckTime = 0;
  if (car.stuckTime > 3.5) { // gridlock happens; reroute rather than freeze the city
    const next = pickNextNode(game.city, car, rng);
    sendCarTo(car, car.nodeTo, next);
    car.stuckTime = 0;
  }
  stepCar(game, car, dt);
}

// The shared body step: move along the heading, bump out of buildings and the sea, and wear
// the paint when the bump was hard. Returns the impact speed (0 when the way was clear).
export function stepCar(game, car, dt) {
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const pos = { x: car.x, y: car.y };
  const before = { x: pos.x, y: pos.y };
  const hit = game.city.moveCircle(pos, nx - car.x, ny - car.y, carRadius(car) * 0.8);
  car.x = pos.x; car.y = pos.y;
  if (hit) {
    const travelled = Math.hypot(car.x - before.x, car.y - before.y);
    const expected = Math.abs(car.speed) * dt;
    if (expected > 2 && travelled < expected * 0.4) {
      const impact = Math.abs(car.speed);
      car.speed *= 0.25;
      return impact;
    }
    car.speed *= 0.82;
  }
  return 0;
}

// The player's driving: throttle, brake/reverse, speed-sensitive steering, a handbrake that
// lets the tail step out. control = { throttle: -1..1, steer: -1..1, handbrake: bool }.
export function updatePlayerCar(game, car, control, dt) {
  const t = car.type;
  if (control.throttle > 0) car.speed += t.accel * control.throttle * dt * (car.speed < 0 ? 2.2 : 1);
  else if (control.throttle < 0) {
    if (car.speed > 12) car.speed -= 760 * dt; // brakes
    else car.speed = Math.max(-t.topSpeed * 0.32, car.speed - t.accel * 0.6 * dt); // reverse
  } else {
    car.speed -= car.speed * 0.55 * dt; // engine braking and drag
    if (Math.abs(car.speed) < 3) car.speed = 0;
  }
  car.speed = Math.min(car.speed, t.topSpeed);
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 130) * (control.handbrake ? 1.5 : 1);
  const turnRate = 2.35 * steerAuthority * Math.sign(car.speed || 1);
  car.angle += control.steer * turnRate * dt * (Math.abs(car.speed) > 4 ? 1 : 0);
  if (control.handbrake) car.speed -= car.speed * 1.4 * dt;
  const impact = stepCar(game, car, dt);
  return impact;
}

// Bump every pair of cars that overlaps: shove them apart, trade speed, bend metal.
export function collideCars(game, dt) {
  const events = [];
  const cars = game.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const rr = carRadius(a) + carRadius(b);
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) / 2;
      const ux = dx / d, uy = dy / d;
      a.x -= ux * push; a.y -= uy * push;
      b.x += ux * push; b.y += uy * push;
      const closing = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.2;
      if (closing > 130) {
        const damage = (closing - 110) * 0.11;
        a.health -= damage; b.health -= damage;
        events.push({ a, b, severity: Math.min(1, closing / 520) });
      }
      const avg = (a.speed + b.speed) / 2;
      if (a.driver !== 'parked') a.speed = avg * 0.7;
      if (b.driver !== 'parked') b.speed = avg * 0.7;
      if (a.health <= 0 && !a.dead) { a.dead = true; a.speed = 0; }
      if (b.health <= 0 && !b.dead) { b.dead = true; b.speed = 0; }
    }
  }
  void dt;
  return events;
}
