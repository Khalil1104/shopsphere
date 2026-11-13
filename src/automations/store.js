'use strict';

const fs = require('fs');
const path = require('path');

/**
 * État des automations (activée / désactivée + historique des exécutions).
 * Gardé dans un petit fichier JSON (data/automations.json) : aucune collection MongoDB en plus.
 */
const FILE = process.env.AUTOMATIONS_FILE || path.resolve(__dirname, '../../data/automations.json');
const MAX_HISTORY = 50;

let state = null;

function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    state = { enabled: {}, lastRunDay: {}, history: [] };
  }
  state.enabled ||= {};
  state.lastRunDay ||= {};
  state.history ||= [];
  return state;
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

module.exports = {
  isEnabled: (key, fallback) => (key in load().enabled ? load().enabled[key] : fallback),
  setEnabled(key, value) {
    load().enabled[key] = Boolean(value);
    save();
  },
  lastRunDay: (key) => load().lastRunDay[key],
  setLastRunDay(key, day) {
    load().lastRunDay[key] = day;
    save();
  },
  addRun(entry) {
    load().history.unshift(entry);
    state.history = state.history.slice(0, MAX_HISTORY);
    save();
  },
  history: (key) => load().history.filter((h) => !key || h.key === key),
  /** Tests uniquement : repart d'un état vide. */
  reset() {
    state = { enabled: {}, lastRunDay: {}, history: [] };
    save();
  }
};
