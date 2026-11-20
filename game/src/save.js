// save.js — localStorage persistence for Solana Heat.
//
// Saves cash, story progress and lifetime stats whenever a mission ends or
// the player saves from the pause menu. Loading is forgiving: a missing or
// corrupt save simply starts a fresh game.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number(data.cash) || 0,
      missionIndex: Number(data.missionIndex) || 0,
      storyDone: Boolean(data.storyDone),
      totalEarned: Number(data.totalEarned) || 0,
      fares: Number(data.fares) || 0,
      missionsDone: Number(data.missionsDone) || 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(player) {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        cash: Math.round(player.cash),
        missionIndex: player.missionIndex,
        storyDone: player.storyDone,
        totalEarned: Math.round(player.totalEarned),
        fares: player.fares,
        missionsDone: player.missionsDone,
      }),
    );
  } catch {
    // Storage can be unavailable (private mode); the game plays on regardless.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
