'use strict';

/** Petites fonctions utilisées dans les vues EJS. */
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const tunis = (d) => new Date(new Date(d).getTime() + 3600 * 1000);

function date(d) {
  if (!d) return '—';
  const t = tunis(d);
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}

function dateTime(d) {
  if (!d) return '—';
  const t = tunis(d);
  return `${date(d)}, ${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
}

function ago(d) {
  if (!d) return 'jamais';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `il y a ${Math.floor(s / 86400)} j`;
  return date(d);
}

const initials = (u) => `${(u.firstName || '?')[0]}${(u.lastName || '')[0] || ''}`.toUpperCase();

/** Couleur d'avatar stable pour une personne (6 teintes sobres). */
function tone(u) {
  const s = String(u.email || u.id || '');
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return `tone-${h % 6}`;
}

/** Appareil lisible à partir du User-Agent. */
function device(ua = '') {
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /PostmanRuntime/.test(ua) ? 'Postman' : null;
  if (os || browser) return [browser, os].filter(Boolean).join(' · ');
  return ua ? ua.slice(0, 40) : 'Appareil inconnu';
}

/** Construit une URL de liste en gardant les filtres actuels. */
function withQuery(base, query, changes) {
  const q = { ...query, ...changes };
  const parts = Object.entries(q).filter(([, v]) => v !== undefined && v !== '' && v !== null);
  return parts.length ? `${base}?${parts.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}` : base;
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

module.exports = { date, dateTime, ago, initials, tone, device, withQuery, plural };
