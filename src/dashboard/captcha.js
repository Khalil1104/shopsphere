'use strict';

const crypto = require('crypto');
const svgCaptcha = require('svg-captcha');
const MemoryStore = require('../utils/memoryStore');
const { sameToken } = require('./session');

/**
 * CAPTCHA de la page de connexion du dashboard.
 * L'image SVG est dessinée par le serveur (lettres en tracés + bruit), sans service externe.
 * La bonne réponse reste dans le serveur (mémoire, 5 min) ; le navigateur ne reçoit qu'un identifiant
 * dans un cookie httpOnly. Chaque CAPTCHA ne sert qu'une fois, juste ou faux.
 */
const COOKIE = 'ss_captcha';
const store = new MemoryStore({ ttlMs: 5 * 60 * 1000 });
const cookieOpts = { httpOnly: true, sameSite: 'strict', path: '/admin' };

/** GET /admin/captcha.svg : nouvelle image. */
function image(req, res) {
  const { data, text } = svgCaptcha.create({
    size: 5,
    noise: 3,
    ignoreChars: '0oO1iIlL', // caractères qui se ressemblent
    color: true,
    background: '#eef2f7',
    width: 180,
    height: 66,
    fontSize: 70
  });
  const id = crypto.randomUUID();
  store.set(id, text.toLowerCase());
  res.cookie(COOKIE, id, { ...cookieOpts, maxAge: 5 * 60 * 1000 });
  res.set('Cache-Control', 'no-store').type('image/svg+xml').send(data);
}

/** Vérifie la réponse du formulaire (champ "captcha"), sans tenir compte des majuscules. */
function check(req, res) {
  const expected = store.take(req.cookies[COOKIE]);
  res.clearCookie(COOKIE, cookieOpts);
  const answer = String((req.body && req.body.captcha) || '').trim().toLowerCase();
  return Boolean(expected) && sameToken(answer, expected);
}

module.exports = { image, check, COOKIE, _store: store };
