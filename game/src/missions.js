// missions.js — the story of Solana Heat and the work that pays. Five chained jobs for the
// fixer Sol Duarte take Rico from a borrowed Comet to the Port Solana Bank job, each a small
// state machine with a marker, an objective line and a clock where it matters. Between jobs,
// taxi fares offer themselves on the pavement: pick up, drop off, get paid. Dialogue banners,
// mission banners and the start-of-job marker at Sol's garage all live here too.

import { HEAT, TAXI_BASE_FARE } from './config.js';
import { addHeat } from './police.js';
import { makeCar } from './vehicles.js';
import { spawnPayday } from './combat.js';
import { writeSave } from './save.js';

export function createMissionState(saved) {
  return {
    index: saved.missionIndex, // the next story job to run
    storyDone: saved.storyDone,
    active: null, // the running job's state machine
    dialogue: [], // queued lines: {who, text, t}
    banner: null, // {title, sub, t, kind}
    fare: null, // the current taxi fare, if any
    fareCooldown: 4,
    objective: '',
    marker: null, // {x, y, color, label}
  };
}

export function say(game, who, text) {
  game.missions.dialogue.push({ who, text, t: 0 });
}

export function setBanner(game, title, sub, kind = 'win') {
  game.missions.banner = { title, sub, t: 4.2, kind };
}

function completeMission(game, reward) {
  const m = game.missions;
  game.cash += reward;
  game.stats.missionsDone += 1;
  const p = game.playerPos();
  spawnPayday(game, p.x, p.y);
  game.audio.payday();
  setBanner(game, 'JOB DONE', `+$${reward} — ${reward >= 2000 ? 'the big one is in the bag' : 'Sol sends his thanks'}`, 'win');
  m.active = null;
  m.index += 1;
  if (m.index >= MISSIONS.length) {
    m.storyDone = true;
    setBanner(game, 'STORY COMPLETE', `+$${reward} — Port Solana is yours, Rico. Fares and free roam remain.`, 'win');
  }
  writeSave(game.saveData());
}

function failMission(game, reason) {
  const m = game.missions;
  m.active = null;
  game.audio.fail();
  setBanner(game, 'JOB FAILED', `${reason} — head back to Sol's Customs to try again`, 'fail');
}

// --- The five jobs -------------------------------------------------------------------

const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    start(game) {
      const city = game.city;
      // A specific Comet waits by the harbour road, keys in, nobody watching. Mostly.
      const car = makeCar(city, 'comet', 3330, 2450, Math.PI, 'parked', game.rng);
      car.color = '#e2483d';
      game.cars.push(car);
      say(game, 'Sol Duarte', 'Rico. You walk everywhere like a tourist. Fix that.');
      say(game, 'Sol Duarte', 'Red Comet, harbour road, keys in the visor. Bring it to my garage. Try not to get seen lifting it.');
      return { stage: 'steal', car };
    },
    update(game, s) {
      const garage = game.city.landmarks.garage.door;
      if (s.stage === 'steal') {
        game.missions.marker = { x: s.car.x, y: s.car.y, color: '#ffd94d', label: 'STEAL' };
        game.missions.objective = 'Steal the red Comet Cabrio';
        if (s.car.dead) return failMission(game, 'The Comet is wrecked');
        if (game.player.car === s.car) {
          s.stage = 'deliver';
          say(game, 'Sol Duarte', 'That is the one. Easy, no? Now bring her home — my garage, east side.');
        }
      } else {
        game.missions.marker = { x: garage.x, y: garage.y, color: '#ffd94d', label: 'DELIVER' };
        game.missions.objective = "Deliver the Comet to Sol's Customs";
        if (s.car.dead) return failMission(game, 'The Comet is wrecked');
        if (game.player.car === s.car) {
          const p = game.playerPos();
          if (Math.hypot(p.x - garage.x, p.y - garage.y) < 110) {
            s.car.driver = 'parked';
            completeMission(game, 300);
          }
        }
      }
    },
  },
  {
    id: 'hot-delivery',
    title: 'Hot Delivery',
    start(game) {
      say(game, 'Sol Duarte', 'A package comes off the boats tonight. No names, no questions.');
      say(game, 'Sol Duarte', 'Pick it up at the harbour, take it to Café Marisol. Two and a half minutes — and arrive quiet. Two stars and the deal is off.');
      return { stage: 'pickup' };
    },
    update(game, s) {
      const harbor = game.city.landmarks.harbor;
      const cafe = game.city.landmarks.cafe.door;
      if (s.stage === 'pickup') {
        game.missions.marker = { x: harbor.x, y: harbor.y, color: '#ffd94d', label: 'PICKUP' };
        game.missions.objective = 'Pick up the package at the harbour';
        const p = game.playerPos();
        if (Math.hypot(p.x - harbor.x, p.y - harbor.y) < 78) {
          s.stage = 'deliver';
          s.timer = 150;
          game.audio.pickup();
          say(game, 'Sol Duarte', 'You have it. Clock is running, Rico. Keep it clean.');
        }
      } else {
        s.timer -= game.dt;
        game.missions.marker = { x: cafe.x, y: cafe.y, color: '#ffd94d', label: 'DELIVER' };
        const heat = game.wanted.heat;
        game.missions.objective = heat > 1
          ? `Lose the heat first — then Café Marisol (${Math.max(0, Math.ceil(s.timer))}s)`
          : `Deliver to Café Marisol (${Math.max(0, Math.ceil(s.timer))}s)`;
        if (s.timer <= 0) return failMission(game, 'The buyer left');
        const p = game.playerPos();
        if (Math.hypot(p.x - cafe.x, p.y - cafe.y) < 84 && heat <= 1) completeMission(game, 500);
      }
    },
  },
  {
    id: 'checkpoint-run',
    title: 'Checkpoint Run',
    start(game) {
      say(game, 'Sol Duarte', 'A collector wants proof this city can be crossed fast. Six gates, three minutes.');
      say(game, 'Sol Duarte', 'Any car you like. Try to bring it back with all its corners.');
      const pts = [[820, 820], [2380, 300], [3420, 1340], [1340, 2380], [300, 2900], [2900, 1860]];
      return { stage: 'run', idx: 0, timer: 180, pts };
    },
    update(game, s) {
      s.timer -= game.dt;
      const [x, y] = s.pts[s.idx];
      game.missions.marker = { x, y, color: '#7bc950', label: `GATE ${s.idx + 1}/6` };
      game.missions.objective = `Checkpoint ${s.idx + 1} of 6 (${Math.max(0, Math.ceil(s.timer))}s)`;
      if (s.timer <= 0) return failMission(game, 'Out of time');
      if (game.player.state !== 'car') game.missions.objective = 'You need a car for the run — ' + game.missions.objective;
      const p = game.playerPos();
      if (game.player.state === 'car' && Math.hypot(p.x - x, p.y - y) < 74) {
        game.audio.chime();
        s.idx += 1;
        if (s.idx >= s.pts.length) completeMission(game, 600);
      }
    },
  },
  {
    id: 'cool-off',
    title: 'Cool Off',
    start(game) {
      say(game, 'Sol Duarte', 'Lesson time. The PSPD are about to take an interest in you.');
      say(game, 'Sol Duarte', 'Do not fight it. Run east, cross the bridge, and lie low at Casa Segura until it blows over.');
      game.wanted.heat = Math.max(game.wanted.heat, 3);
      return { stage: 'escape' };
    },
    update(game, s) {
      const safe = game.city.landmarks.safehouse.door;
      game.missions.marker = { x: safe.x, y: safe.y, color: '#39c2d7', label: 'SAFEHOUSE' };
      const heat = game.wanted.heat;
      game.missions.objective = heat > 0.05
        ? 'Lose the heat — lie low at Casa Segura on Solana Key'
        : 'Heat is gone. Touch the safehouse door to finish';
      const p = game.playerPos();
      if (heat <= 0.05 && Math.hypot(p.x - safe.x, p.y - safe.y) < 130) completeMission(game, 700);
    },
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    start(game) {
      say(game, 'Sol Duarte', 'Last job, Rico. Port Solana Bank, on the boulevard. The vault drinks are on me after.');
      say(game, 'Sol Duarte', 'Walk in, stay in the circle while the bag fills — four seconds — then run for the Key and lie low. The whole city will come.');
      return { stage: 'bank', hold: 0 };
    },
    update(game, s) {
      const bank = game.city.landmarks.bank.door;
      const safe = game.city.landmarks.safehouse.door;
      const p = game.playerPos();
      if (s.stage === 'bank') {
        game.missions.marker = { x: bank.x, y: bank.y, color: '#ffd94d', label: 'BANK' };
        game.missions.objective = 'Go to Port Solana Bank — on foot, walk in';
        if (game.player.state === 'foot' && Math.hypot(p.x - bank.x, p.y - bank.y) < 64) {
          s.stage = 'rob';
          addHeat(game, HEAT.robbery, p.x, p.y);
          game.wanted.heat = Math.max(game.wanted.heat, 4);
          say(game, 'Rico', 'Nobody move. Bag. Now.');
        }
      } else if (s.stage === 'rob') {
        game.missions.marker = { x: bank.x, y: bank.y, color: '#e2483d', label: 'HOLD' };
        const inside = game.player.state === 'foot' && Math.hypot(p.x - bank.x, p.y - bank.y) < 64;
        if (inside) s.hold += game.dt;
        game.missions.objective = `Filling the bag… ${Math.min(4, s.hold).toFixed(1)} / 4.0s${inside ? '' : ' — get back in the circle!'}`;
        if (s.hold >= 4) {
          s.stage = 'escape';
          say(game, 'Sol Duarte', 'GO. Bridge, Key, safehouse. Do not stop for anyone.');
        }
      } else {
        game.missions.marker = { x: safe.x, y: safe.y, color: '#39c2d7', label: 'SAFEHOUSE' };
        const heat = game.wanted.heat;
        game.missions.objective = heat >= 1
          ? 'Escape to Casa Segura and lie low until the heat drops'
          : 'Reach Casa Segura to finish the job';
        if (Math.hypot(p.x - safe.x, p.y - safe.y) < 130 && heat < 1) completeMission(game, 2000);
      }
    },
  },
];

export function startMission(game, index) {
  const def = MISSIONS[index];
  if (!def) return;
  game.missions.active = { def, state: def.start(game) };
  setBanner(game, def.title.toUpperCase(), 'A new job from Sol Duarte', 'info');
}

// --- Taxi fares ------------------------------------------------------------------------

function offerFare(game) {
  const m = game.missions;
  // A waiting passenger: a live ped near the player's side of the city.
  const p = game.playerPos();
  const candidates = game.peds.filter((ped) => !ped.dead && ped.state !== 'down'
    && Math.hypot(ped.x - p.x, ped.y - p.y) > 200 && Math.hypot(ped.x - p.x, ped.y - p.y) < 1500);
  if (!candidates.length) return;
  const ped = candidates[Math.floor(game.rng() * candidates.length)];
  ped.isFare = true;
  // A destination with a door: any named building will do.
  const named = game.city.buildings.filter((b) => b.name);
  const dest = named[Math.floor(game.rng() * named.length)];
  m.fare = {
    stage: 'pickup', ped,
    dest: { x: dest.x + dest.w / 2, y: dest.y + dest.h + 24, name: dest.name },
    dist: 0,
  };
}

function updateFare(game, dt) {
  const m = game.missions;
  if (!m.fare) {
    m.fareCooldown -= dt;
    if (m.fareCooldown <= 0 && game.player.state === 'car') offerFare(game);
    return;
  }
  const fare = m.fare;
  if (fare.stage === 'pickup') {
    if (fare.ped.dead || fare.ped.state === 'down') { fare.ped.isFare = false; m.fare = null; m.fareCooldown = 6; return; }
    fare.ped.target = null; // they wait, arm half-raised
    if (!m.active) {
      m.marker = { x: fare.ped.x, y: fare.ped.y, color: '#f7b731', label: 'FARE' };
      m.objective = game.player.state === 'car' ? 'Taxi: pick up the passenger' : 'Taxi fare waiting — you need a car (T to decline)';
    }
    const p = game.playerPos();
    if (game.player.state === 'car' && Math.abs(game.player.car.speed) < 60 && Math.hypot(p.x - fare.ped.x, p.y - fare.ped.y) < 52) {
      fare.stage = 'dropoff';
      fare.dist = Math.hypot(fare.dest.x - fare.ped.x, fare.dest.y - fare.ped.y);
      fare.ped.gone = true; // in the back seat now; the ped leaves the street
      game.audio.door();
      say(game, 'Passenger', `${fare.dest.name}, please. And I am already late.`);
    }
  } else {
    if (!m.active) {
      m.marker = { x: fare.dest.x, y: fare.dest.y, color: '#f7b731', label: 'DROP OFF' };
      m.objective = `Taxi: drop off at ${fare.dest.name}`;
    }
    const p = game.playerPos();
    if (game.player.state === 'car' && Math.hypot(p.x - fare.dest.x, p.y - fare.dest.y) < 76) {
      const amount = Math.round(TAXI_BASE_FARE + fare.dist / 22);
      game.cash += amount;
      game.stats.faresDone += 1;
      game.audio.payday();
      spawnPayday(game, p.x, p.y);
      setBanner(game, 'FARE PAID', `+$${amount} — five stars, probably`, 'win');
      writeSave(game.saveData());
      m.fare = null;
      m.fareCooldown = 7;
    }
  }
}

// --- The per-frame tick ------------------------------------------------------------------

export function updateMissions(game, dt) {
  const m = game.missions;
  game.dt = dt;

  // Dialogue lines age out on their own; the box shows the head of the queue.
  if (m.dialogue.length) {
    m.dialogue[0].t += dt;
    if (m.dialogue[0].t > 4.4) m.dialogue.shift();
  }
  if (m.banner) {
    m.banner.t -= dt;
    if (m.banner.t <= 0) m.banner = null;
  }

  // Jobs start at Sol's garage door, where the S marker hangs when work is waiting.
  if (!m.active && !m.storyDone) {
    const door = game.city.landmarks.garage.door;
    const p = game.playerPos();
    m.marker = { x: door.x, y: door.y, color: '#ffd94d', label: 'SOL' };
    m.objective = `See Sol at Sol's Customs — job ${m.index + 1} of ${MISSIONS.length}: ${MISSIONS[m.index].title}`;
    if (Math.hypot(p.x - door.x, p.y - door.y) < 92 && game.state === 'playing') {
      startMission(game, m.index);
    }
  }

  if (m.active) {
    m.active.def.update(game, m.active.state);
  }

  updateFare(game, dt);

  // Declining a fare with T clears the offer for a while.
  if (game.pressed('KeyT') && m.fare && m.fare.stage === 'pickup') {
    m.fare.ped.isFare = false;
    m.fare = null;
    m.fareCooldown = 10;
  }
}
