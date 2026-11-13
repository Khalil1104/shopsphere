'use strict';

const config = require('../config/env');
const store = require('./store');
const tasks = require('./tasks');

const byKey = Object.fromEntries(tasks.map((t) => [t.key, t]));
let timer = null;

/** Date et heure à Tunis (UTC+1 toute l'année). */
function tunisNow() {
  const t = new Date(Date.now() + 3600 * 1000);
  return { day: t.toISOString().slice(0, 10), time: t.toISOString().slice(11, 16) };
}

const isEnabled = (task) => store.isEnabled(task.key, task.defaultEnabled);

/** Lance une tâche et enregistre le résultat dans l'historique. */
async function run(key, { by = 'planificateur', payload } = {}) {
  const task = byKey[key];
  if (!task) throw new Error(`Automation inconnue : ${key}`);
  const startedAt = new Date();
  let entry;
  try {
    const result = await task.run(payload);
    entry = { key, name: task.name, by, status: 'success', summary: result.summary, count: result.count };
  } catch (err) {
    entry = { key, name: task.name, by, status: 'error', summary: err.message, count: 0 };
    if (!config.isTest) console.error(`Automation ${key} : ${err.message}`);
  }
  entry.startedAt = startedAt;
  entry.durationMs = Date.now() - startedAt.getTime();
  store.addRun(entry);
  return entry;
}

/** Appelée chaque minute : lance les tâches quotidiennes dont l'heure est passée et pas encore faites aujourd'hui. */
async function tick() {
  const { day, time } = tunisNow();
  for (const task of tasks) {
    if (task.type !== 'daily' || !isEnabled(task)) continue;
    if (time >= task.time && store.lastRunDay(task.key) !== day) {
      store.setLastRunDay(task.key, day);
      await run(task.key);
    }
  }
}

/** Déclenchement par événement (ex. "account.autoSuspended"). Ne bloque jamais la requête. */
function emit(event, payload) {
  if (event !== 'account.autoSuspended') return;
  const task = byKey['security-alert'];
  if (isEnabled(task)) run(task.key, { by: 'événement', payload }).catch(() => {});
}

function start() {
  if (timer || config.isTest) return;
  // Premier démarrage : on ne rattrape pas les tâches dont l'heure est déjà passée aujourd'hui
  // (sinon le rapport et les rappels partiraient dès l'installation).
  const { day, time } = tunisNow();
  for (const task of tasks) {
    if (task.type === 'daily' && !store.lastRunDay(task.key) && time >= task.time) store.setLastRunDay(task.key, day);
  }
  timer = setInterval(() => tick().catch(() => {}), 60 * 1000);
  timer.unref();
  tick().catch(() => {});
}

/** Vue pour le dashboard : tâches + état + dernière exécution. */
function list() {
  return tasks.map((task) => {
    const history = store.history(task.key);
    return {
      key: task.key,
      name: task.name,
      description: task.description,
      type: task.type,
      schedule: task.type === 'daily' ? `Tous les jours à ${task.time}` : task.trigger,
      enabled: isEnabled(task),
      lastRun: history[0] || null,
      runs: history.length
    };
  });
}

module.exports = {
  run,
  tick,
  emit,
  start,
  list,
  history: () => store.history(),
  setEnabled: (key, value) => {
    if (!byKey[key]) throw new Error(`Automation inconnue : ${key}`);
    store.setEnabled(key, value);
  },
  exists: (key) => Boolean(byKey[key])
};
