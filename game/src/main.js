// main.js — Solana Heat's engine room: the game state, the loop, the
// player, and the wiring that turns actions into consequences.
//
// Everything shares one state object, G. Modules each own a slice of it:
// city.js the world, vehicles.js the cars, peds.js the people, police.js
// the law, missions.js the story, combat.js the violence, hud.js and
// render.js the pictures. Crimes committed anywhere are reported through
// G.onCrime and friends, and the wanted system answers here.

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H } from './config.js';
import { buildCity, clamp, inWater, dist2, resolveCircle } from './city.js';
import { attachInput, input, endFrameInput, wasPressed, isDown } from './input.js';
import { buildStaticLayer, drawScene } from './render.js';
import { drawHUD, drawTitle, drawPause, drawEndScreen } from './hud.js';
import { spawnParkedCars, ensureTraffic, updateVehicles, updatePlayerCar, updateCarCollisions, nearestCar, makeCar } from './vehicles.js';
import { ensurePeds, updatePeds, makePed } from './peds.js';
import { updatePolice, addHeat, CRIME_HEAT, starsOf } from './police.js';
import { playerShoot, updateFx, spawnSparks, spawnSplash } from './combat.js';
import { initMissions, updateMissions, currentTarget, availableStoryMission, startMission, toggleTaxi, STORY } from './missions.js';
import { initAudio, setSiren, setEngine, sfxFail } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function freshPlayer(save) {
  return {
    x: 1232, y: 1420, // on Calle Brisa, a short walk from Sol's garage
    angle: 0,
    speedNow: 0,
    walkPhase: 0,
    health: 100,
    lastDamageT: -99,
    cash: save ? save.cash : 60,
    missionIndex: save ? save.missionIndex : 0,
    storyDone: save ? save.storyDone : false,
    totalEarned: save ? save.totalEarned : 0,
    fares: save ? save.fares : 0,
    missionsDone: save ? save.missionsDone : 0,
    inCar: null,
    fireT: 0,
  };
}

function buildGame() {
  const city = buildCity();
  const G = {
    mode: 'title',
    time: 0,
    clock: 17 * 60 + 24, // golden hour, 17:24
    city,
    staticLayer: null,
    cars: [],
    peds: [],
    cops: [],
    particles: [],
    tracers: [],
    floaters: [],
    player: freshPlayer(loadSave()),
    wanted: { heat: 0, lastSeenT: -99, lastCrimeT: -99, seenNow: false, spawnT: 0 },
    bustT: 0,
    camera: { x: 0, y: 0 },
    shake: 0,
    prompt: null,
    banner: null,
    dialogue: null,
    mission: null,
    taxi: null,
    currentTarget: null,
    mouseWorld: { x: 0, y: 0 },
    hasSave: Boolean(loadSave()),
  };
  G.staticLayer = buildStaticLayer(city);
  spawnParkedCars(G);
  // The story's red Comet waits by the garage, always.
  const spot = city.landmarks.cometSpot;
  const comet = makeCar('comet', spot.x, spot.y, 0, 'parked');
  comet.color = '#e2483d';
  G.cars.push(comet);
  ensureTraffic(G);
  ensurePeds(G);
  initMissions(G);
  wireConsequences(G);
  return G;
}

// Actions become crimes, crimes become heat, heat becomes police.
function wireConsequences(G) {
  G.spawnSparks = (x, y, n) => spawnSparks(G, x, y, n);
  G.spawnSplash = (x, y) => spawnSplash(G, x, y);
  G.onCrime = (kind) => {
    if (CRIME_HEAT[kind]) addHeat(G, CRIME_HEAT[kind]);
  };
  G.onPedHit = (ped, car) => {
    if (car.driver !== 'player') return;
    addHeat(G, ped.dead ? CRIME_HEAT.pedKilled : CRIME_HEAT.pedHit);
  };
  G.onPedKilled = () => addHeat(G, CRIME_HEAT.pedKilled);
  G.onCopCarHit = () => addHeat(G, CRIME_HEAT.copCarHit);
  G.onPlayerCrash = () => {
    // A crash is only a crime if someone saw it.
    const p = G.player;
    const witnessed = G.cops.length > 0
      || G.peds.some((ped) => !ped.dead && dist2(ped.x, ped.y, p.x, p.y) < 300 * 300);
    if (witnessed) addHeat(G, CRIME_HEAT.crash);
  };
  G.onBusted = () => {
    if (G.mode === 'play') {
      G.mode = 'busted';
      setEngine(null);
      setSiren(false);
      sfxFail();
    }
  };
}

const G = buildGame();
attachInput(canvas);

// ---- Starting, restarting, respawning -------------------------------------

function startGame(fresh) {
  initAudio();
  if (fresh) {
    clearSave();
    const keep = { x: G.player.x, y: G.player.y };
    G.player = freshPlayer(null);
    G.player.x = keep.x;
    G.player.y = keep.y;
    G.wanted.heat = 0;
    G.hasSave = false;
  }
  G.mode = 'play';
  if (!G.player.storyDone && G.player.missionIndex === 0 && !G.mission.active) {
    startMission(G, 0);
  }
}

function respawn() {
  const p = G.player;
  const hospital = G.city.landmarks.hospital;
  if (p.inCar) {
    p.inCar.driver = 'parked';
    p.inCar = null;
  }
  p.x = hospital.x + 30;
  p.y = hospital.y + 90;
  p.health = 100;
  p.cash = Math.max(0, p.cash - 150);
  G.wanted.heat = 0;
  G.bustT = 0;
  // The police wander off; their cars stay where they were left.
  for (const cop of G.cops) {
    const idx = G.cars.indexOf(cop);
    if (idx >= 0) G.cars.splice(idx, 1);
  }
  G.cops = [];
  setEngine(null);
  setSiren(false);
  G.mode = 'play';
  writeSave(p);
}

// ---- The player -------------------------------------------------------------

function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  let mx = 0;
  let my = 0;
  if (isDown('KeyW', 'ArrowUp')) my -= 1;
  if (isDown('KeyS', 'ArrowDown')) my += 1;
  if (isDown('KeyA', 'ArrowLeft')) mx -= 1;
  if (isDown('KeyD', 'ArrowRight')) mx += 1;
  const len = Math.hypot(mx, my) || 1;
  const speed = 178;
  const prevX = p.x;
  const prevY = p.y;
  p.x += (mx / len) * speed * dt * (mx || my ? 1 : 0);
  p.y += (my / len) * speed * dt * (mx || my ? 1 : 0);
  p.speedNow = mx || my ? speed : 0;
  p.walkPhase += dt * (p.speedNow > 0 ? 11 : 0);
  // Face the mouse: Rico shoots where he looks.
  p.angle = Math.atan2(G.mouseWorld.y - p.y, G.mouseWorld.x - p.x);

  // Buildings are solid; the sea is out of bounds for a man on foot.
  resolveCircle(G.city, p, 11);
  if (inWater(p.x, p.y)) {
    p.x = prevX;
    p.y = prevY;
  }

  // Traffic is dangerous: a fast car clips Rico for real damage.
  for (const car of G.cars) {
    if (car.dead || Math.abs(car.speed) < 55) continue;
    if (dist2(p.x, p.y, car.x, car.y) < 27 * 27) {
      p.health -= Math.abs(car.speed) * 0.055;
      p.lastDamageT = G.time;
      p.x += Math.cos(car.angle) * 22;
      p.y += Math.sin(car.angle) * 22;
      G.shake = Math.min(8, Math.abs(car.speed) * 0.02);
      break;
    }
  }

  // Shooting.
  p.fireT -= dt;
  if (input.mouseDown) playerShoot(G);
}

function tryEnterExitCar(G) {
  const p = G.player;
  if (p.inCar) {
    const car = p.inCar;
    car.driver = 'parked';
    p.inCar = null;
    // Step out on the left side of the car.
    p.x = car.x + Math.cos(car.angle - Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle - Math.PI / 2) * 30;
    setEngine(null);
    return;
  }
  const car = nearestCar(G, p.x, p.y, 56);
  if (!car) return;
  const wasTraffic = car.driver === 'traffic';
  car.driver = 'player';
  car.speed = Math.min(car.speed, 40);
  p.inCar = car;
  if (wasTraffic) {
    // The driver bails out and runs, and if anyone saw it, it is theft.
    const driver = makePed(car.x + 24, car.y + 10);
    driver.state = 'flee';
    driver.fleeT = 3;
    driver.fleeFrom = { x: p.x, y: p.y };
    G.peds.push(driver);
    const witnessed = G.cops.length > 0
      || G.peds.some((ped) => !ped.dead && dist2(ped.x, ped.y, p.x, p.y) < 290 * 290);
    if (witnessed) addHeat(G, CRIME_HEAT.carjack);
  }
}

function updatePrompts(G) {
  const p = G.player;
  G.prompt = null;
  if (G.mode !== 'play' || G.dialogue) return;
  if (p.inCar) {
    if (!G.taxi && !G.mission.active) G.prompt = 'T — look for a taxi fare';
    return;
  }
  const car = nearestCar(G, p.x, p.y, 56);
  if (car) {
    G.prompt = car.driver === 'traffic' ? `E — steal the ${car.type.label}` : `E — drive the ${car.type.label}`;
    return;
  }
  const garage = G.city.landmarks.garage;
  if (availableStoryMission(G) && dist2(p.x, p.y, garage.x, garage.y) < 120 * 120) {
    G.prompt = `F — take the job: "${STORY[p.missionIndex].title}"`;
  }
}

// ---- The loop ---------------------------------------------------------------

function updatePlay(G, dt) {
  const p = G.player;

  if (wasPressed('KeyE')) tryEnterExitCar(G);
  if (wasPressed('KeyF')) {
    const garage = G.city.landmarks.garage;
    if (!p.inCar && availableStoryMission(G) && dist2(p.x, p.y, garage.x, garage.y) < 130 * 130) {
      startMission(G, p.missionIndex);
    }
  }
  if (wasPressed('KeyT')) toggleTaxi(G);
  if (wasPressed('KeyP', 'Escape')) {
    G.mode = 'pause';
    setEngine(null);
    return;
  }

  if (p.inCar) {
    const control = {
      throttle: (isDown('KeyW', 'ArrowUp') ? 1 : 0) + (isDown('KeyS', 'ArrowDown') ? -1 : 0),
      steer: (isDown('KeyA', 'ArrowLeft') ? -1 : 0) + (isDown('KeyD', 'ArrowRight') ? 1 : 0),
      handbrake: isDown('Space'),
    };
    updatePlayerCar(G, dt, control);
    p.x = p.inCar.x;
    p.y = p.inCar.y;
    p.speedNow = Math.abs(p.inCar.speed);
    setEngine(clamp(Math.abs(p.inCar.speed) / p.inCar.type.top, 0, 1), Math.abs(control.throttle));
  } else {
    updatePlayerOnFoot(G, dt);
  }

  updateVehicles(G, dt);
  updateCarCollisions(G);
  updatePolice(G, dt);
  updatePeds(G, dt);
  updateFx(G, dt);
  updateMissions(G, dt);
  G.currentTarget = currentTarget(G);
  updatePrompts(G);

  // Health creeps back when Rico stays out of trouble.
  if (G.time - p.lastDamageT > 6 && p.health > 0) {
    p.health = Math.min(100, p.health + 2.6 * dt);
  }
  if (p.health <= 0 && G.mode === 'play') {
    p.health = 0;
    G.mode = 'wasted';
    setEngine(null);
    setSiren(false);
    sfxFail();
  }

  // Siren follows the nearest chase.
  const stars = starsOf(G);
  setSiren(stars > 0 && G.cops.some((c) => !c.dead && dist2(c.x, c.y, p.x, p.y) < 720 * 720));
}

function updateCamera(G, dt) {
  const p = G.player;
  let tx = p.x - VIEW_W / 2;
  let ty = p.y - VIEW_H / 2;
  if (p.inCar) {
    tx += Math.cos(p.inCar.angle) * p.inCar.speed * 0.34;
    ty += Math.sin(p.inCar.angle) * p.inCar.speed * 0.34;
  }
  if (G.mode === 'title') {
    // A slow drift over downtown for the title screen.
    tx = 900 + Math.sin(G.time * 0.05) * 420 - VIEW_W / 2 + 640;
    ty = 620 + Math.cos(G.time * 0.037) * 260 - VIEW_H / 2 + 360;
  }
  const k = G.mode === 'title' ? 1 : 1 - Math.pow(0.0015, dt);
  G.camera.x += (clamp(tx, 0, WORLD_W - VIEW_W) - G.camera.x) * (G.mode === 'title' ? 0.4 : k);
  G.camera.y += (clamp(ty, 0, WORLD_H - VIEW_H) - G.camera.y) * (G.mode === 'title' ? 0.4 : k);
  G.camera.x = clamp(G.camera.x, 0, WORLD_W - VIEW_W);
  G.camera.y = clamp(G.camera.y, 0, WORLD_H - VIEW_H);
}

let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts;
  G.time += dt;
  G.clock += dt * 0.4;
  G.shake = Math.max(0, G.shake - dt * 30);
  G.mouseWorld.x = input.mouseX + G.camera.x;
  G.mouseWorld.y = input.mouseY + G.camera.y;

  if (G.mode === 'title') {
    if (wasPressed('Enter') || input.mouseClicked) startGame(false);
    else if (wasPressed('KeyN')) startGame(true);
  } else if (G.mode === 'play') {
    updatePlay(G, dt);
  } else if (G.mode === 'pause') {
    if (wasPressed('KeyP', 'Escape')) G.mode = 'play';
    else if (wasPressed('KeyS')) {
      writeSave(G.player);
      G.hasSave = true;
      G.banner = { title: 'GAME SAVED', sub: 'Port Solana will remember this.', t: 2, color: '#7be495' };
      G.mode = 'play';
    } else if (wasPressed('KeyR')) {
      if (G.mission.active) {
        G.mission.active = null;
        G.banner = { title: 'MISSION ABANDONED', sub: 'See Sol at the garage to try again.', t: 2.6, color: '#ffb35c' };
      }
      G.mode = 'play';
    } else if (wasPressed('KeyQ')) {
      G.mode = 'title';
    }
    if (G.banner) {
      G.banner.t -= dt;
      if (G.banner.t <= 0) G.banner = null;
    }
  } else if (G.mode === 'busted' || G.mode === 'wasted') {
    updateFx(G, dt);
    if (wasPressed('Enter') || input.mouseClicked) respawn();
  }

  updateCamera(G, dt);
  drawScene(G, ctx);
  if (G.mode === 'play' || G.mode === 'pause') drawHUD(G, ctx);
  if (G.mode === 'title') drawTitle(G, ctx, G.hasSave);
  if (G.mode === 'pause') drawPause(G, ctx);
  if (G.mode === 'busted' || G.mode === 'wasted') drawEndScreen(G, ctx, G.mode);
  endFrameInput();
}

// ---- Staged scenes for screenshots (?scene=drive|chase|mission|onfoot) -----

function makeCopAt(G, x, y, angle) {
  const cop = makeCar('cop', x, y, angle, 'cop');
  cop.ai = { stuckT: 0, reverseT: 0, sirenPhase: Math.random() * Math.PI * 2 };
  G.cars.push(cop);
  G.cops.push(cop);
  return cop;
}

function putPlayerInCar(G, typeKey, x, y, angle, speed) {
  const car = makeCar(typeKey, x, y, angle, 'player');
  car.speed = speed;
  G.cars.push(car);
  G.player.inCar = car;
  G.player.x = x;
  G.player.y = y;
  return car;
}

function stageScene(G) {
  const params = new URLSearchParams(window.location.search);
  const scene = params.get('scene');
  if (!scene) return;
  G.mode = 'play';
  const p = G.player;
  if (scene === 'drive') {
    putPlayerInCar(G, 'comet', 1250, 918, 0, 165);
    p.cash = 1240;
  } else if (scene === 'chase') {
    // Flat out over the bridge to Solana Key, Interceptors in trail:
    // the capture lands mid-span, sea on both sides, island ahead.
    putPlayerInCar(G, 'comet', 3080, 918, 0, 250);
    p.cash = 2875;
    G.wanted.heat = 2.6;
    G.wanted.lastSeenT = 0;
    makeCopAt(G, 2955, 918, 0).speed = 242;
    makeCopAt(G, 2830, 918, 0).speed = 234;
    makeCopAt(G, 2710, 918, 0).speed = 226;
  } else if (scene === 'mission') {
    putPlayerInCar(G, 'comet', 500, 1760, 0, 120);
    p.cash = 760;
    p.missionIndex = 1;
    startMission(G, 1);
    if (G.dialogue) G.dialogue.t = -6; // hold the briefing on screen a while
  } else if (scene === 'onfoot') {
    p.x = 472;
    p.y = 1004;
    p.angle = -0.5;
    p.cash = 430;
    // A small crowd on the shopping street's sidewalks.
    const spots = [[512, 1000], [852, 1010], [512, 1200], [852, 1210], [680, 932], [700, 1272]];
    for (const [sx, sy] of spots) {
      const ped = makePed(sx, sy);
      ped.col = 1;
      ped.row = 2;
      G.peds.push(ped);
    }
  }
  G.currentTarget = currentTarget(G);
  // Settle the camera on the player before the first frame.
  G.camera.x = clamp(p.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
  G.camera.y = clamp(p.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
}

stageScene(G);
window.__solanaHeat = G; // a handle for automated play-tests and staging
requestAnimationFrame(frame);
