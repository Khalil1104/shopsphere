'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

// --- Mots de passe (bcrypt) -------------------------------------------------
const hashPassword = (plain) => bcrypt.hash(plain, config.bcryptRounds);
const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

// --- Jetons envoyés par e-mail (vérification, mot de passe oublié) -----------
// Le jeton en clair part dans l'e-mail ; seul son hash SHA-256 est stocké en base.
const generateToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// --- JWT ---------------------------------------------------------------------
/**
 * Signe le JWT d'une session.
 *  - sub  : id de l'utilisateur
 *  - type : "client" ou "admin" (collection où chercher l'utilisateur)
 *  - sid  : identifiant de la session stockée dans le document de l'utilisateur
 * Retourne aussi la date d'expiration, enregistrée dans la session.
 */
function signSessionJwt(user, type, sid) {
  const token = jwt.sign({ type, role: user.role, sid }, config.jwt.secret, {
    subject: String(user._id),
    expiresIn: config.jwt.expiresIn,
    algorithm: 'HS256'
  });
  const { exp } = jwt.decode(token);
  return { token, expiresAt: new Date(exp * 1000) };
}

const verifyJwt = (token) => jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });

// --- Jeton de double authentification ------------------------------------------
// Donné après un bon mot de passe quand la 2FA est active. Il ne permet RIEN d'autre
// que d'envoyer le code : il est signé avec une clé dérivée, donc refusé partout ailleurs.
const twoFactorSecret = () => `${config.jwt.secret}:2fa`;

function signTwoFactorChallenge(user, type, cid) {
  const token = jwt.sign({ type, cid }, twoFactorSecret(), {
    subject: String(user._id),
    expiresIn: `${config.twoFactorMinutes}m`,
    algorithm: 'HS256'
  });
  return { token, expiresAt: new Date(jwt.decode(token).exp * 1000) };
}

const verifyTwoFactorChallenge = (token) => jwt.verify(token, twoFactorSecret(), { algorithms: ['HS256'] });

/** Code à 6 chiffres tiré au hasard (crypto, pas Math.random). */
const sixDigitCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

/** Comparaison en temps constant de deux chaînes. */
function safeEqual(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const newSessionId = () => crypto.randomUUID();

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  hashToken,
  signSessionJwt,
  verifyJwt,
  newSessionId,
  signTwoFactorChallenge,
  verifyTwoFactorChallenge,
  sixDigitCode,
  safeEqual
};
