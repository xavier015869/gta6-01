// missions.js — the story of Rico Vega, told in five jobs, plus the
// taxi fares that keep a free-roaming wheelman fed.
//
// Sol Duarte runs a garage on Calle Brisa and always has work: first a
// simple drive, then a hot delivery, a checkpoint run, a lesson in
// losing the police, and finally the Banco del Sol job that sets Rico
// up for good. Each mission is a small state machine of stages with a
// world target, an optional timer, and dialogue before and after.
// Progress, cash and stats persist through save.js.

import { dist2 } from './city.js';
import { addHeat, CRIME_HEAT } from './police.js';
import { addFloater } from './combat.js';
import { sfxCash, sfxFail, sfxChime } from './audio.js';
import { writeSave } from './save.js';

const ARRIVE_R = 62; // how close counts as reaching a target

function near(G, t, r = ARRIVE_R) {
  const p = G.player.inCar || G.player;
  return dist2(p.x, p.y, t.x, t.y) < r * r;
}

function say(G, lines) {
  G.dialogue = { lines, idx: 0, t: 0 };
}

export const STORY = [
  {
    title: 'Welcome to Port Solana',
    reward: 150,
    intro: [
      { who: 'Sol Duarte', text: 'Rico Vega. Heard you drove in with eleven dollars and a dead phone.' },
      { who: 'Sol Duarte', text: 'That red Comet by the garage is yours if you can still drive. Take it. Then come back and see me.' },
      { who: 'Rico', text: 'Still the softest heart on Calle Brisa, Sol.' },
    ],
    outro: [
      { who: 'Sol Duarte', text: 'You drive like you mean it. Good. Port Solana pays people who mean it.' },
    ],
    stages: [
      {
        label: 'Get into the red Comet',
        target: (G) => G.city.landmarks.cometSpot,
        check: (G) => Boolean(G.player.inCar && G.player.inCar.typeKey === 'comet'),
      },
      {
        label: "Drive back to Sol's Garage",
        target: (G) => G.city.landmarks.garage,
        check: (G) => near(G, G.city.landmarks.garage, 90),
      },
    ],
  },
  {
    title: 'Special Delivery',
    reward: 400,
    intro: [
      { who: 'Sol Duarte', text: 'Harbor Freight has a crate that cannot be on any manifest. Pick it up at the docks.' },
      { who: 'Sol Duarte', text: 'Then the Hotel Marisol, fast. The moment that crate moves, the PSPD will care. Two stars of care.' },
    ],
    outro: [
      { who: 'Marisol', text: 'Sol sends a driver with a heartbeat. Rare. Tell her the hotel owes her one.' },
    ],
    stages: [
      {
        label: 'Pick up the crate at Harbor Freight',
        target: (G) => G.city.landmarks.harbor,
        check: (G) => near(G, G.city.landmarks.harbor),
        onDone: (G) => {
          addHeat(G, CRIME_HEAT.missionHeat);
          addFloater(G, G.player.x, G.player.y - 30, 'CRATE LOADED — GO!', '#ffd76a');
        },
      },
      {
        label: 'Deliver to Hotel Marisol — hurry!',
        target: (G) => G.city.landmarks.hotel,
        timer: 150,
        check: (G) => near(G, G.city.landmarks.hotel),
      },
    ],
  },
  {
    title: 'Checkpoint Run',
    reward: 600,
    intro: [
      { who: 'Sol Duarte', text: 'A sponsor wants proof you know this city better than the satnav does.' },
      { who: 'Sol Duarte', text: 'Six checkpoints, one clock. Any car you like. Try not to bend it.' },
    ],
    outro: [
      { who: 'Sol Duarte', text: 'Fastest lap the sponsor has seen all year. The money is real, Rico.' },
    ],
    stages: [], // built dynamically below: six checkpoints, one shared clock
    buildStages(G) {
      const pts = [
        { x: 472, y: 472 }, { x: 2152, y: 472 }, { x: 2992, y: 892 },
        { x: 2152, y: 1732 }, { x: 472, y: 1732 }, { x: 1312, y: 1102 },
      ];
      return pts.map((pt, i) => ({
        label: `Checkpoint ${i + 1} of 6`,
        target: () => pt,
        timer: i === 0 ? 135 : null, // the clock starts with the first leg
        keepTimer: i > 0,
        check: (G2) => near(G2, pt, 70),
      }));
    },
  },
  {
    title: 'Lose the Heat',
    reward: 900,
    intro: [
      { who: 'Sol Duarte', text: 'Lesson time. I am about to make you very popular with the police.' },
      { who: 'Sol Duarte', text: 'Get to Casa Segura on Solana Key and lay low until the stars are gone. The bridge is your friend.' },
    ],
    outro: [
      { who: 'Sol Duarte', text: 'Cold as ice. That is the whole job, some days: disappear well.' },
    ],
    stages: [
      {
        label: 'Reach Casa Segura on Solana Key',
        target: (G) => G.city.landmarks.safehouse,
        onStart: (G) => addHeat(G, 3.2),
        check: (G) => near(G, G.city.landmarks.safehouse, 110),
      },
      {
        label: 'Lay low until the heat dies',
        target: (G) => G.city.landmarks.safehouse,
        check: (G) => near(G, G.city.landmarks.safehouse, 200) && G.wanted.heat < 0.25,
      },
    ],
  },
  {
    title: 'The Marisol Job',
    reward: 2500,
    intro: [
      { who: 'Sol Duarte', text: 'Last one, Rico. Banco del Sol, midday. You hold the door, the vault team does the rest.' },
      { who: 'Sol Duarte', text: 'Four stars, minimum. Then the Key, lay low, and we are both retired by Friday.' },
      { who: 'Rico', text: 'You had me at retired.' },
    ],
    outro: [
      { who: 'Sol Duarte', text: 'Clean. Cold. Paid. Port Solana is yours now, Rico — try to leave it standing.' },
    ],
    stages: [
      {
        label: 'Go to Banco del Sol',
        target: (G) => G.city.landmarks.bank,
        check: (G) => near(G, G.city.landmarks.bank, 80),
      },
      {
        label: 'Hold position while the vault team works',
        target: (G) => G.city.landmarks.bank,
        hold: 4,
        onStart: (G) => addHeat(G, CRIME_HEAT.robbery),
        check: (G) => (G.mission.holdT || 0) >= 4,
      },
      {
        label: 'Escape to Casa Segura',
        target: (G) => G.city.landmarks.safehouse,
        check: (G) => near(G, G.city.landmarks.safehouse, 110),
      },
      {
        label: 'Lay low until the heat dies',
        target: (G) => G.city.landmarks.safehouse,
        check: (G) => near(G, G.city.landmarks.safehouse, 220) && G.wanted.heat < 0.25,
      },
    ],
  },
];

export function initMissions(G) {
  G.mission = {
    active: null, // { def, stageIdx, stage, timerLeft, defIdx }
    holdT: 0,
  };
  G.taxi = null;
  G.dialogue = null;
}

export function availableStoryMission(G) {
  if (G.mission.active || G.player.storyDone) return null;
  return STORY[G.player.missionIndex] || null;
}

export function startMission(G, defIdx) {
  const def = STORY[defIdx];
  if (!def) return;
  const stages = def.buildStages ? def.buildStages(G) : def.stages;
  G.mission.active = { def, defIdx, stages, stageIdx: 0, timerLeft: null };
  G.mission.holdT = 0;
  say(G, def.intro);
  sfxChime();
  const first = stages[0];
  first.onStart?.(G);
  if (first.timer) G.mission.active.timerLeft = first.timer;
}

function completeMission(G) {
  const { def, defIdx } = G.mission.active;
  G.mission.active = null;
  G.player.cash += def.reward;
  G.player.totalEarned += def.reward;
  G.player.missionsDone += 1;
  G.player.missionIndex = defIdx + 1;
  if (G.player.missionIndex >= STORY.length) G.player.storyDone = true;
  G.banner = { title: 'MISSION COMPLETE', sub: `${def.title}  •  +$${def.reward}`, t: 3.4, color: '#7be495' };
  addFloater(G, G.player.x, G.player.y - 44, `+$${def.reward}`, '#7be495');
  sfxCash();
  say(G, def.outro);
  writeSave(G.player);
}

function failMission(G, why) {
  G.mission.active = null;
  G.banner = { title: 'MISSION FAILED', sub: why, t: 3.2, color: '#ff7a6b' };
  sfxFail();
}

export function currentTarget(G) {
  const m = G.mission.active;
  if (m) {
    const stage = m.stages[m.stageIdx];
    const t = stage.target(G);
    return { x: t.x, y: t.y, label: stage.label, kind: 'mission' };
  }
  if (G.taxi) {
    const t = G.taxi.stage === 'pickup' ? G.taxi.passenger : G.taxi.dest;
    return { x: t.x, y: t.y, label: G.taxi.stage === 'pickup' ? 'Pick up the passenger' : 'Drop off the passenger', kind: 'taxi' };
  }
  if (!G.player.storyDone && !m) {
    // Point idle players at the garage, where the next job waits.
    const g = G.city.landmarks.garage;
    return { x: g.x, y: g.y, label: 'See Sol at the garage (F)', kind: 'story' };
  }
  return null;
}

export function updateMissions(G, dt) {
  // Dialogue clock.
  if (G.dialogue) {
    G.dialogue.t += dt;
    if (G.dialogue.t > 3.6) {
      G.dialogue.t = 0;
      G.dialogue.idx += 1;
      if (G.dialogue.idx >= G.dialogue.lines.length) G.dialogue = null;
    }
  }
  if (G.banner) {
    G.banner.t -= dt;
    if (G.banner.t <= 0) G.banner = null;
  }

  const m = G.mission.active;
  if (m) {
    const stage = m.stages[m.stageIdx];
    // Timers: a stage may start the clock, later legs may keep it.
    if (m.timerLeft !== null && m.timerLeft !== undefined) {
      m.timerLeft -= dt;
      if (m.timerLeft <= 0) {
        failMission(G, 'Out of time. Sol is not impressed.');
        return;
      }
    }
    // Hold stages (the bank robbery) accumulate time inside the ring.
    if (stage.hold) {
      if (near(G, stage.target(G), 85)) G.mission.holdT += dt;
      else G.mission.holdT = Math.max(0, G.mission.holdT - dt * 1.5);
    }
    if (stage.check(G)) {
      stage.onDone?.(G);
      m.stageIdx += 1;
      G.mission.holdT = 0;
      if (m.stageIdx >= m.stages.length) {
        completeMission(G);
        return;
      }
      const next = m.stages[m.stageIdx];
      next.onStart?.(G);
      if (next.timer) m.timerLeft = next.timer;
      else if (!next.keepTimer) m.timerLeft = null;
      sfxChime();
    }
  }

  updateTaxi(G, dt);
}

// ---- Taxi fares: the honest work between dishonest jobs ------------------

export function toggleTaxi(G) {
  if (!G.player.inCar) return;
  if (G.taxi) {
    G.taxi = null;
    G.banner = { title: 'FARE CANCELLED', sub: 'The passenger walks.', t: 2.2, color: '#ffb35c' };
    return;
  }
  // A passenger waits at a random block corner a few streets away.
  const col = 1 + Math.floor(Math.random() * 6);
  const row = Math.floor(Math.random() * 5);
  const px = col * 420 + 92 + Math.random() * 20;
  const py = row * 420 + 92 + Math.random() * 20;
  G.taxi = { stage: 'pickup', passenger: { x: px, y: py }, dest: null, fareBase: 0 };
  G.banner = { title: 'TAXI FARE', sub: 'Pick up the passenger — follow the blue marker.', t: 2.6, color: '#7cc7ff' };
  sfxChime();
}

function updateTaxi(G, dt) {
  const taxi = G.taxi;
  if (!taxi || !G.player.inCar) return;
  const car = G.player.inCar;
  if (taxi.stage === 'pickup') {
    if (dist2(car.x, car.y, taxi.passenger.x, taxi.passenger.y) < 52 * 52 && Math.abs(car.speed) < 30) {
      const col = Math.floor(Math.random() * 7);
      const row = Math.floor(Math.random() * 5);
      taxi.dest = { x: col * 420 + 210, y: row * 420 + 210 };
      taxi.stage = 'dropoff';
      taxi.fareBase = Math.hypot(taxi.dest.x - car.x, taxi.dest.y - car.y);
      addFloater(G, car.x, car.y - 34, 'PASSENGER IN', '#7cc7ff');
      sfxChime();
    }
  } else if (dist2(car.x, car.y, taxi.dest.x, taxi.dest.y) < 58 * 58 && Math.abs(car.speed) < 30) {
    const fare = Math.round(35 + taxi.fareBase * 0.055);
    G.player.cash += fare;
    G.player.totalEarned += fare;
    G.player.fares += 1;
    addFloater(G, car.x, car.y - 34, `FARE +$${fare}`, '#7be495');
    G.banner = { title: 'FARE PAID', sub: `+$${fare} — press T in a car for another.`, t: 2.4, color: '#7be495' };
    sfxCash();
    writeSave(G.player);
    G.taxi = null;
  }
}
