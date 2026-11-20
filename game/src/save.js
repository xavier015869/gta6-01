// save.js — persistence in the browser's localStorage: cash, story progress and a lifetime
// stats sheet. A save is small and forgiving: anything missing or corrupt reads as "no save",
// and the title screen simply offers a new game.

import { SAVE_KEY } from './config.js';

export function defaultStats() {
  return {
    carsStolen: 0,
    faresDone: 0,
    missionsDone: 0,
    busts: 0,
    wasted: 0,
    shotsFired: 0,
    distanceDriven: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number.isFinite(data.cash) ? data.cash : 250,
      missionIndex: Number.isInteger(data.missionIndex) ? data.missionIndex : 0,
      storyDone: !!data.storyDone,
      stats: { ...defaultStats(), ...(data.stats || {}) },
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.round(state.cash),
      missionIndex: state.missionIndex,
      storyDone: state.storyDone,
      stats: state.stats,
    }));
  } catch {
    // Storage can be unavailable (private windows, quotas); the game plays on regardless.
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
}

export function hasSave() {
  return loadSave() !== null;
}
