'use strict';

const AppError = require('../utils/AppError');
const { verifyJwt } = require('../utils/security');
const sessionService = require('../services/sessionService');
const Client = require('../models/Client');
const Admin = require('../models/Admin');

/**
 * authenticate : lit "Authorization: Bearer <token>", vérifie le JWT,
 * recharge l'utilisateur depuis la base, puis vérifie que la session (sid) existe encore.
 *  - compte supprimé           → 401
 *  - compte suspendu           → 403
 *  - session fermée (logout)   → 401
 * Résultat : req.user (document) et req.auth = { id, type, role, sid }.
 */
async function authenticate(req, _res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(AppError.unauthorized('Jeton manquant'));

  let payload;
  try {
    payload = verifyJwt(token);
  } catch (err) {
    return next(AppError.unauthorized(err.name === 'TokenExpiredError' ? 'Session expirée, reconnectez-vous' : 'Jeton invalide'));
  }

  const Model = payload.type === 'admin' ? Admin : Client;
  const user = await Model.findById(payload.sub).select('+sessions');
  if (!user) return next(AppError.unauthorized('Compte introuvable'));
  if (user.accountStatus !== 'ACTIVE') return next(AppError.forbidden('Compte suspendu'));
  if (!payload.sid || !(await sessionService.touch(user, payload.type, payload.sid))) {
    return next(AppError.unauthorized('Session fermée ou expirée, reconnectez-vous'));
  }

  req.user = user;
  req.auth = { id: String(user._id), type: payload.type, role: user.role, sid: payload.sid };
  return next();
}

/** authorize('ADMIN') ou authorize('CUSTOMER') : contrôle du rôle. */
const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.auth && req.auth.role) ? next() : next(AppError.forbidden("Vous n'avez pas les droits nécessaires"));

/** Pour les futures commandes : bloque un client dont l'e-mail n'est pas vérifié. */
const requireVerifiedEmail = (req, _res, next) =>
  req.user && req.user.isEmailVerified ? next() : next(AppError.forbidden('Vérifiez votre adresse e-mail avant de continuer'));

module.exports = { authenticate, authorize, requireVerifiedEmail };
