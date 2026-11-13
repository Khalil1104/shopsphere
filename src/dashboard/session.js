'use strict';

const crypto = require('crypto');
const config = require('../config/env');
const Admin = require('../models/Admin');
const sessionService = require('../services/sessionService');
const { verifyJwt } = require('../utils/security');

/**
 * Connexion au dashboard : le JWT de la session admin est gardé dans un cookie httpOnly
 * (inaccessible au JavaScript du navigateur) limité au chemin /admin.
 * Chaque formulaire porte un jeton CSRF dérivé de la session (HMAC) : un site tiers ne peut pas le deviner.
 */
const COOKIE = 'ss_admin';
const FLASH = 'ss_flash';

const cookieBase = { httpOnly: true, sameSite: 'strict', path: '/admin', secure: config.env === 'production' };

const csrfFor = (sid) => crypto.createHmac('sha256', config.jwt.secret).update(`csrf:${sid}`).digest('hex').slice(0, 40);

/** Comparaison en temps constant. Un jeton absent ou vide n'est jamais accepté. */
function sameToken(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(COOKIE, token, { ...cookieBase, expires: expiresAt });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, cookieBase);
}

/** Message affiché une seule fois sur la page suivante (après une redirection). */
function flash(res, type, text) {
  res.cookie(FLASH, JSON.stringify({ type, text }), { ...cookieBase, maxAge: 30 * 1000 });
}

function readFlash(req, res, next) {
  if (req.cookies[FLASH]) {
    try {
      res.locals.flash = JSON.parse(req.cookies[FLASH]);
    } catch {
      // cookie illisible : ignoré
    }
    res.clearCookie(FLASH, cookieBase);
  }
  next();
}

/** Lit le cookie, vérifie le JWT, le compte et la session. Sinon : page de connexion. */
async function requireAdmin(req, res, next) {
  const back = () => {
    clearSessionCookie(res);
    const nextUrl = req.method === 'GET' ? `?next=${encodeURIComponent(req.originalUrl)}` : '';
    return res.redirect(`/admin/login${nextUrl}`);
  };
  const token = req.cookies[COOKIE];
  if (!token) return back();

  let payload;
  try {
    payload = verifyJwt(token);
  } catch {
    return back();
  }
  if (payload.type !== 'admin') return back();

  const admin = await Admin.findById(payload.sub).select('+sessions');
  if (!admin || admin.accountStatus !== 'ACTIVE' || !(await sessionService.touch(admin, 'admin', payload.sid))) return back();

  req.admin = admin;
  req.auth = { id: String(admin._id), type: 'admin', role: 'ADMIN', sid: payload.sid };
  res.locals.me = admin;
  res.locals.csrf = csrfFor(payload.sid);
  return next();
}

/** Tout formulaire POST doit renvoyer le bon jeton CSRF. */
function checkCsrf(req, res, next) {
  if (req.method !== 'POST') return next();
  const sent = (req.body && req.body._csrf) || req.get('x-csrf-token');
  if (!sameToken(sent, csrfFor(req.auth.sid))) {
    return res.status(403).send('Jeton de sécurité invalide. Rechargez la page et réessayez.');
  }
  if (req.body) delete req.body._csrf;
  return next();
}

module.exports = { COOKIE, setSessionCookie, clearSessionCookie, flash, readFlash, requireAdmin, checkCsrf, csrfFor, sameToken };
