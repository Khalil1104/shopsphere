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

const newSessionId = () => crypto.randomUUID();

module.exports = { hashPassword, comparePassword, generateToken, hashToken, signSessionJwt, verifyJwt, newSessionId };
