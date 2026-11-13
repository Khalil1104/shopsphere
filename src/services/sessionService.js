'use strict';

const config = require('../config/env');
const AppError = require('../utils/AppError');
const Client = require('../models/Client');
const Admin = require('../models/Admin');
const { signSessionJwt, newSessionId } = require('../utils/security');

/**
 * Sessions stockées dans le tableau "sessions" du document client / admin.
 * Aucune collection supplémentaire : la base garde seulement "clients" et "admins".
 */
const modelFor = (type) => (type === 'admin' ? Admin : Client);

/** Crée une session à la connexion et renvoie le JWT qui la représente. */
async function open(user, type, { ip, userAgent }) {
  const sid = newSessionId();
  const { token, expiresAt } = signSessionJwt(user, type, sid);
  const Model = modelFor(type);

  // 1. On retire les sessions expirées
  await Model.updateOne({ _id: user._id }, { $pull: { sessions: { expiresAt: { $lte: new Date() } } } });
  // 2. On ajoute la nouvelle ; $slice garde seulement les MAX_SESSIONS plus récentes
  await Model.updateOne(
    { _id: user._id },
    {
      $push: {
        sessions: {
          $each: [{ sid, ip, userAgent: (userAgent || '').slice(0, 300), createdAt: new Date(), lastUsedAt: new Date(), expiresAt }],
          $slice: -config.maxSessions
        }
      },
      $set: { lastLoginAt: new Date(), failedLoginAttempts: 0 }
    }
  );
  return { token, sid, expiresAt };
}

/** Vrai si la session existe encore et n'est pas expirée. Met à jour "lastUsedAt" (au plus 1 fois / minute). */
async function touch(user, type, sid) {
  const session = (user.sessions || []).find((s) => s.sid === sid && s.expiresAt > new Date());
  if (!session) return false;
  if (Date.now() - session.lastUsedAt.getTime() > 60 * 1000) {
    await modelFor(type).updateOne({ _id: user._id, 'sessions.sid': sid }, { $set: { 'sessions.$.lastUsedAt': new Date() } });
  }
  return true;
}

/** Liste des appareils connectés (sessions non expirées), la plus récente en premier. */
async function list(userId, type, currentSid) {
  const user = await modelFor(type).findById(userId).select('+sessions');
  return (user.sessions || [])
    .filter((s) => s.expiresAt > new Date())
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .map((s) => ({
      sid: s.sid,
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      current: s.sid === currentSid
    }));
}

/** Ferme une session (déconnexion d'un appareil). */
async function close(userId, type, sid) {
  const res = await modelFor(type).updateOne({ _id: userId, 'sessions.sid': sid }, { $pull: { sessions: { sid } } });
  if (res.modifiedCount === 0) throw AppError.notFound('Session introuvable');
}

/** Ferme toutes les sessions (déconnexion de tous les appareils, suspension, nouveau mot de passe). */
async function closeAll(userId, type) {
  const res = await modelFor(type).findByIdAndUpdate(userId, { $set: { sessions: [] } }).select('+sessions');
  return res ? res.sessions.length : 0;
}

module.exports = { open, touch, list, close, closeAll };
