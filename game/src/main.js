// main.js — Solana Heat's conductor. It builds the world, owns the player (Rico, on foot
// and behind the wheel), runs the frame loop that ticks traffic, peds, police, combat and
// missions in order, answers the menus, applies busted and wasted, moves the camera, and
// stages the ?scene= set-ups the screenshots are taken from. Everything else is a specialist;
// this file is the game.

import { PLAYER_RADIUS, PLAYER_WALK, PLAYER_RUN, HEAT, BUST_FINE_BASE, BUST_FINE_PER_STAR, HOSPITAL_FEE } from './config.js';
import { generateCity, makeRng } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave, hasSave, defaultStats } from './save.js';
import { makeCar, createTraffic, createParked, updateTrafficCar, updatePlayerCar, collideCars } from './vehicles.js';
import { createPeds, updatePed, carHitsPed, scarePeds, makePed, sidewalkCorners } from './peds.js';
import { createWanted, addHeat, updatePolice, starsOf } from './police.js';
import { fireShot, updateParticles, spawnSmoke, spawnParticles } from './combat.js';
import { createMissionState, updateMissions, startMission } from './missions.js';
import { drawScene } from './render.js';
import { drawHUD, drawMenus } from './hud.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  game.camera.w = canvas.width;
  game.camera.h = canvas.height;
}
window.addEventListener('resize', resize);

const game = {
  city: generateCity(),
  rng: makeRng((Math.random() * 1e9) | 0),
  input: null,
  audio: createAudio(),
  cars: [],
  peds: [],
  corners: [],
  particles: [],
  tracers: [],
  player: {
    x: 3120, y: 2330, angle: -Math.PI / 2, aim: 0,
    state: 'foot', car: null, health: 100, moving: false,
    fireCooldown: 0, hurtTimer: 0,
  },
  wanted: createWanted(),
  missions: null,
  cash: 250,
  stats: defaultStats(),
  state: 'title', // 'title' | 'playing' | 'paused' | 'busted' | 'wasted'
  camera: { x: 1200, y: 1400, w: 1280, h: 720 },
  time: 0,
  clock: 17 * 60 + 5, // the city lives at golden hour: 17:05 and counting
  buttons: [],
  hasSaveFile: false,
  policeSpawnTimer: 0,
  lastFine: 0,
  frame: { pressed: new Set(), clicked: false, wheel: 0 },
  smokeTimer: 0,
  titlePan: 0,

  pressed(code) { return this.frame.pressed.has(code); },
  playerPos() {
    const p = this.player;
    return p.state === 'car' && p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
  },
  playerVelocity() {
    const p = this.player;
    if (p.state === 'car' && p.car) return { x: Math.cos(p.car.angle) * p.car.speed, y: Math.sin(p.car.angle) * p.car.speed };
    return { x: 0, y: 0 };
  },
  playerAtSafehouse() {
    const safe = this.city.landmarks.safehouse.door;
    const p = this.playerPos();
    return Math.hypot(p.x - safe.x, p.y - safe.y) < 210;
  },
  saveData() {
    return {
      cash: this.cash,
      missionIndex: this.missions ? this.missions.index : 0,
      storyDone: this.missions ? this.missions.storyDone : false,
      stats: this.stats,
    };
  },
};
game.input = createInput(canvas);
game.corners = sidewalkCorners(game.city);
game.missions = createMissionState({ missionIndex: 0, storyDone: false });
game.hasSaveFile = hasSave();
resize();

// --- World (re)building -----------------------------------------------------------------

function populateWorld() {
  game.cars = [...createTraffic(game.city, game.rng), ...createParked(game.city, game.rng)];
  const { peds } = createPeds(game.city, game.rng);
  game.peds = peds;
  game.particles = [];
  game.tracers = [];
}

function resetPlayerAt(x, y) {
  const p = game.player;
  p.x = x; p.y = y;
  p.state = 'foot';
  p.car = null;
  p.health = 100;
  p.fireCooldown = 0;
  game.wanted = createWanted();
  game.policeSpawnTimer = 0;
}

function newGame() {
  clearSave();
  game.cash = 250;
  game.stats = defaultStats();
  game.missions = createMissionState({ missionIndex: 0, storyDone: false });
  populateWorld();
  const door = game.city.landmarks.garage.door;
  resetPlayerAt(door.x - 130, door.y + 30);
  game.state = 'playing';
  game.hasSaveFile = false;
  snapCamera();
}

function continueGame() {
  const saved = loadSave();
  if (!saved) return newGame();
  game.cash = saved.cash;
  game.stats = saved.stats;
  game.missions = createMissionState(saved);
  populateWorld();
  const door = game.city.landmarks.garage.door;
  resetPlayerAt(door.x - 130, door.y + 30);
  game.state = 'playing';
  snapCamera();
}

function respawn() {
  const p = game.player;
  if (game.state === 'busted') {
    game.cash = Math.max(0, game.cash - game.lastFine);
    if (p.car) { // impounded: the car leaves the world with the PSPD
      game.cars.splice(game.cars.indexOf(p.car), 1);
    }
    const hq = game.city.landmarks.police.door;
    resetPlayerAt(hq.x, hq.y + 10);
  } else {
    game.cash = Math.max(0, game.cash - game.lastFine);
    if (p.car) { p.car.driver = 'parked'; }
    const clinic = game.city.landmarks.hospital.door;
    resetPlayerAt(clinic.x, clinic.y + 10);
  }
  game.state = 'playing';
  writeSave(game.saveData());
  snapCamera();
}

// --- The player ---------------------------------------------------------------------------

function nearestStealableCar() {
  const p = game.player;
  let best = null, bd = 66;
  for (const car of game.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  const p = game.player;
  const wasTraffic = car.driver === 'traffic';
  const firstSteal = !car.stolenOnce;
  if (wasTraffic) {
    // The driver bails out and runs for it.
    const ped = makePed(game.corners, game.rng, { x: car.x, y: car.y });
    ped.x = car.x + 20; ped.y = car.y + 14;
    ped.state = 'flee'; ped.fleeFrom = { x: p.x, y: p.y }; ped.fleeTime = 3;
    game.peds.push(ped);
  }
  car.driver = 'player';
  car.stolenOnce = true;
  p.state = 'car';
  p.car = car;
  game.audio.door();
  if (firstSteal && car.typeKey !== 'interceptor') {
    game.stats.carsStolen += 1;
    addHeat(game, HEAT.carjackWitnessed * 0.9, car.x, car.y);
  } else if (car.typeKey === 'interceptor') {
    addHeat(game, 1.4, car.x, car.y); // stealing the law itself is never quiet
  }
}

function exitCar() {
  const p = game.player;
  const car = p.car;
  if (!car) return;
  car.driver = 'parked';
  const side = car.angle + Math.PI / 2;
  const pos = { x: car.x + Math.cos(side) * (car.type.w / 2 + 16), y: car.y + Math.sin(side) * (car.type.w / 2 + 16) };
  if (game.city.isWater(pos.x, pos.y)) { pos.x = car.x - Math.cos(side) * (car.type.w / 2 + 16); pos.y = car.y - Math.sin(side) * (car.type.w / 2 + 16); }
  p.x = pos.x; p.y = pos.y;
  p.state = 'foot';
  p.car = null;
  game.audio.door();
}

function updatePlayerOnFoot(dt) {
  const p = game.player;
  const input = game.input;
  let mx = 0, my = 0;
  if (input.down('KeyW', 'ArrowUp')) my -= 1;
  if (input.down('KeyS', 'ArrowDown')) my += 1;
  if (input.down('KeyA', 'ArrowLeft')) mx -= 1;
  if (input.down('KeyD', 'ArrowRight')) mx += 1;
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (len > 0) {
    mx /= len; my /= len;
    const speed = input.down('ShiftLeft', 'ShiftRight') ? PLAYER_RUN : PLAYER_WALK;
    const pos = { x: p.x, y: p.y };
    game.city.moveCircle(pos, mx * speed * dt, my * speed * dt, PLAYER_RADIUS);
    p.x = pos.x; p.y = pos.y;
    p.angle = Math.atan2(my, mx);
  }
  // Aim always faces the mouse, in world space.
  const m = game.input.mouse;
  p.aim = Math.atan2(m.y + game.camera.y - p.y, m.x + game.camera.x - p.x);
  if (!p.moving) p.angle = p.aim;

  if (game.pressed('KeyE')) {
    const car = nearestStealableCar();
    if (car) { enterCar(car); return; }
  }

  // The pistol: click, a crack, a tracer — and the whole street hears it.
  p.fireCooldown -= dt;
  if (game.input.mouse.down && p.fireCooldown <= 0) {
    p.fireCooldown = 0.21;
    game.stats.shotsFired += 1;
    game.audio.shot();
    const hit = fireShot(game, p.x, p.y, p.aim);
    addHeat(game, HEAT.gunshot, p.x, p.y);
    if (hit.kind === 'ped') addHeat(game, HEAT.pedShot, hit.x, hit.y);
    if (hit.kind === 'car' && hit.car.driver === 'police') addHeat(game, HEAT.hitCopCar, hit.x, hit.y);
    scarePeds(game, p.x, p.y, 270);
  }
}

function updatePlayerDriving(dt) {
  const p = game.player;
  const car = p.car;
  const input = game.input;
  const control = {
    throttle: (input.down('KeyW', 'ArrowUp') ? 1 : 0) + (input.down('KeyS', 'ArrowDown') ? -1 : 0),
    steer: (input.down('KeyA', 'ArrowLeft') ? -1 : 0) + (input.down('KeyD', 'ArrowRight') ? 1 : 0),
    handbrake: input.down('Space'),
  };
  const impact = updatePlayerCar(game, car, control, dt);
  game.stats.distanceDriven += Math.abs(car.speed) * dt;
  p.x = car.x; p.y = car.y;
  if (impact > 240) {
    game.audio.crash(Math.min(1, impact / 560));
    hurtPlayer((impact - 220) * 0.028);
    spawnParticles(game, car.x, car.y, { count: 8, color: '#cfc8b8', speed: 130, life: 0.4, size: 3 });
    if (impact > 300) addHeat(game, HEAT.hitCar * 0.7, car.x, car.y);
  }
  if (game.pressed('KeyE') && Math.abs(car.speed) < 130) exitCar();
}

function hurtPlayer(amount) {
  const p = game.player;
  p.health -= amount;
  p.hurtTimer = 4;
  if (amount > 3) game.audio.hurt();
}

// --- The frame ----------------------------------------------------------------------------

function snapCamera() {
  const p = game.playerPos();
  game.camera.x = clamp(p.x - game.camera.w / 2, 0, Math.max(0, game.city.width - game.camera.w));
  game.camera.y = clamp(p.y - game.camera.h / 2, 0, Math.max(0, game.city.height - game.camera.h));
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function updateCamera(dt) {
  const p = game.playerPos();
  const v = game.playerVelocity();
  const tx = p.x + v.x * 0.34 - game.camera.w / 2;
  const ty = p.y + v.y * 0.34 - game.camera.h / 2;
  const k = 1 - Math.pow(0.0015, dt); // smooth, frame-rate independent follow
  game.camera.x += (clamp(tx, 0, Math.max(0, game.city.width - game.camera.w)) - game.camera.x) * k;
  game.camera.y += (clamp(ty, 0, Math.max(0, game.city.height - game.camera.h)) - game.camera.y) * k;
}

function handleButtons() {
  if (!game.frame.clicked) return;
  const m = game.input.mouse;
  for (const b of game.buttons) {
    if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) {
      game.audio.wake();
      if (b.action === 'new') newGame();
      else if (b.action === 'continue') continueGame();
      else if (b.action === 'resume') game.state = 'playing';
      else if (b.action === 'title') { game.state = 'title'; game.hasSaveFile = hasSave(); }
      else if (b.action === 'mute') game.audio.toggleMute();
      else if (b.action === 'respawn') respawn();
      return;
    }
  }
}

function updatePlaying(dt) {
  const p = game.player;
  if (game.pressed('Escape')) { game.state = 'paused'; game.audio.stopLoops(); return; }

  if (p.state === 'foot') updatePlayerOnFoot(dt); else updatePlayerDriving(dt);

  for (const car of game.cars) updateTrafficCar(game, car, dt, game.rng);
  const crashes = collideCars(game, dt);
  for (const ev of crashes) {
    const involvesPlayer = ev.a === p.car || ev.b === p.car;
    const involvesPolice = ev.a.driver === 'police' || ev.b.driver === 'police';
    if (involvesPlayer) {
      game.audio.crash(ev.severity);
      hurtPlayer(ev.severity * 7);
      if (involvesPolice) addHeat(game, HEAT.hitCopCar * 0.6, p.x, p.y);
      else if (ev.severity > 0.45) addHeat(game, HEAT.hitCar, p.x, p.y);
    }
  }
  // Cars meeting people: only the player's conduct earns heat, but everyone falls the same.
  for (const car of game.cars) {
    if (Math.abs(car.speed) < 40) continue;
    for (const ped of game.peds) {
      if (ped.gone) continue;
      const result = carHitsPed(car, ped);
      if (result && car === p.car) {
        addHeat(game, HEAT.hitPed, ped.x, ped.y);
        game.audio.crash(0.4);
        hurtPlayer(1.5);
      }
    }
  }

  for (const ped of game.peds) if (!ped.gone) updatePed(game, ped, dt, game.rng);
  updatePolice(game, dt, game.rng);
  updateMissions(game, dt);
  updateParticles(game, dt);

  // Smoke from the wounded.
  game.smokeTimer -= dt;
  if (game.smokeTimer <= 0) {
    game.smokeTimer = 0.1;
    for (const car of game.cars) {
      if (car.dead || car.health < car.type.health * 0.45) spawnSmoke(game, car);
    }
  }

  // Health returns when the day calms down.
  p.hurtTimer -= dt;
  if (p.hurtTimer <= 0 && p.health > 0) p.health = Math.min(100, p.health + 5.5 * dt);

  // Endings.
  if (game.wanted.bust >= 1) {
    game.stats.busts += 1;
    game.lastFine = Math.min(game.cash, BUST_FINE_BASE + BUST_FINE_PER_STAR * starsOf(game.wanted.heat));
    game.state = 'busted';
    game.audio.stopLoops();
    return;
  }
  if (p.health <= 0) {
    game.stats.wasted += 1;
    game.lastFine = Math.min(game.cash, HOSPITAL_FEE);
    game.state = 'wasted';
    game.audio.stopLoops();
    return;
  }

  // Sound follows the action.
  const driving = p.state === 'car';
  game.audio.engine(driving ? Math.abs(p.car.speed) / p.car.type.topSpeed : 0, driving);
  const policeNear = game.cars.some((c) => c.driver === 'police' && !c.dead
    && Math.hypot(c.x - p.x, c.y - p.y) < 950);
  game.audio.siren(policeNear && game.wanted.heat > 0, dt);
  game.clock += dt * 1.5;
}

function updateTitleWorld(dt) {
  // Behind the title, the city lives: traffic rolls, people stroll, the camera drifts
  // down the boulevard.
  for (const car of game.cars) updateTrafficCar(game, car, dt, game.rng);
  for (const ped of game.peds) if (!ped.gone) updatePed(game, ped, dt, game.rng);
  updateParticles(game, dt);
  game.titlePan += dt * 26;
  const x = 700 + (Math.sin(game.titlePan * 0.011) * 0.5 + 0.5) * 1900;
  game.camera.x = x;
  game.camera.y = 1500 + Math.sin(game.titlePan * 0.007) * 260;
}

let lastTime = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  let dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  if (dt <= 0) dt = 0.016;
  game.time += dt;
  game.frame = game.input.consumeFrame();

  if (game.pressed('KeyM')) game.audio.toggleMute();
  if (game.frame.pressed.size || game.frame.clicked) game.audio.wake();

  if (game.state === 'title') {
    updateTitleWorld(dt);
    if (game.pressed('Enter')) { game.hasSaveFile ? continueGame() : newGame(); }
    handleButtons();
  } else if (game.state === 'playing') {
    updatePlaying(dt);
    updateCamera(dt);
  } else if (game.state === 'paused') {
    if (game.pressed('Escape') || game.pressed('Enter')) game.state = 'playing';
    handleButtons();
  } else if (game.state === 'busted' || game.state === 'wasted') {
    if (game.pressed('Enter')) respawn();
    handleButtons();
    updateParticles(game, dt);
  }

  drawScene(ctx, game);
  if (game.state !== 'title') drawHUD(ctx, game);
  if (game.state === 'title' || game.state === 'paused' || game.state === 'busted' || game.state === 'wasted') {
    drawMenus(ctx, game);
  }
  if (statusEl) {
    statusEl.textContent = game.state === 'playing' ? (game.missions.objective || 'Free roam in Port Solana') : `Solana Heat — ${game.state}`;
  }
}

// --- Staging: the screenshot scenes ---------------------------------------------------------

function stageScene(name) {
  populateWorld();
  game.cash = 640;
  game.stats = defaultStats();
  game.missions = createMissionState({ missionIndex: 0, storyDone: false });
  const P = game.player;
  if (name === 'drive') {
    game.missions = createMissionState({ missionIndex: 1, storyDone: false });
    game.stats.missionsDone = 1;
    game.cash = 1250;
    // A clear run east down the boulevard: clear the traffic out of the shot's first stretch.
    game.cars = game.cars.filter((c) => !(Math.abs(c.y - 1860) < 80 && c.x > 1000 && c.x < 2300));
    const car = makeCar(game.city, 'comet', 1150, 1883, 0, 'player', game.rng);
    car.color = '#e2483d';
    car.speed = 480;
    game.cars.push(car);
    P.state = 'car'; P.car = car; P.x = car.x; P.y = car.y;
    game.missions.objective = 'See Sol at Sol\'s Customs — job 2 of 5: Hot Delivery';
  } else if (name === 'chase') {
    game.missions = createMissionState({ missionIndex: 2, storyDone: false });
    game.stats.missionsDone = 2;
    game.cash = 2340;
    const car = makeCar(game.city, 'meridian', 1900, 1883, 0, 'player', game.rng);
    car.speed = 470;
    car.color = '#3d5a80';
    game.cars.push(car);
    P.state = 'car'; P.car = car; P.x = car.x; P.y = car.y;
    game.wanted.heat = 2.7; // three stars, no more, no less
    const copSpots = [[-190, 1852], [-330, 1906], [-470, 1860]];
    for (const [off, cy] of copSpots) {
      const cop = makeCar(game.city, 'interceptor', 1900 + off, cy, 0, 'police', game.rng);
      cop.speed = 450;
      game.cars.push(cop);
    }
    game.missions.objective = 'Lose the PSPD — break their line of sight';
  } else if (name === 'mission') {
    game.missions = createMissionState({ missionIndex: 1, storyDone: false });
    game.stats.missionsDone = 1;
    game.cash = 550;
    resetPlayerAt(3090, 2870);
    startMission(game, 1);
  } else if (name === 'onfoot') {
    game.cash = 860;
    resetPlayerAt(1150, 1924);
    P.angle = -Math.PI / 2;
    // A busier pavement for the camera: neighbours strolling the same shopping street,
    // and two cars parallel-parked at the kerb.
    for (let i = 0; i < 7; i++) {
      const ped = makePed(game.corners, game.rng, { x: 1000 + i * 60, y: 1924 });
      ped.x = 990 + i * 58; ped.y = 1918 + (i % 3) * 13;
      game.peds.push(ped);
    }
    const parked1 = makeCar(game.city, 'pico', 1300, 1928, 0, 'parked', game.rng);
    const parked2 = makeCar(game.city, 'meridian', 950, 1796, Math.PI, 'parked', game.rng);
    game.cars.push(parked1, parked2);
  } else {
    return false;
  }
  game.state = 'playing';
  snapCamera();
  return true;
}

populateWorld();
const scene = new URLSearchParams(window.location.search).get('scene');
if (scene) stageScene(scene);
requestAnimationFrame(tick);

// A handle for the maker's own test scripts: read the world, never write it.
window.__solanaHeat = game;
