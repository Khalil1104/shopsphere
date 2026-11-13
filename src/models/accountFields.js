'use strict';

const mongoose = require('mongoose');

/**
 * Une session = une connexion sur un appareil.
 * Elle est stockée DANS le document du client / de l'admin (tableau "sessions") :
 * aucune collection supplémentaire. Le JWT contient l'identifiant "sid" de la session.
 */
const sessionSchema = new mongoose.Schema(
  {
    sid: { type: String, required: true },
    ip: { type: String },
    userAgent: { type: String, maxlength: 300 },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
  },
  { _id: false }
);

/** Champs de sécurité communs aux clients et aux admins. */
const securityFields = () => ({
  accountStatus: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
  statusReason: { type: String, trim: true, maxlength: 300 },
  // true quand la suspension vient de 5 mots de passe faux (et non d'un admin)
  suspendedForFailedLogins: { type: Boolean, default: false },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  lastLoginAt: { type: Date },
  sessions: { type: [sessionSchema], default: [], select: false },

  passwordResetToken: { type: String, select: false }, // hash SHA-256
  passwordResetExpires: { type: Date, select: false },

  // Double authentification : code à 6 chiffres envoyé par e-mail après le mot de passe
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorCode: { type: String, select: false }, // hash SHA-256 de "défi:code"
  twoFactorExpires: { type: Date, select: false },
  twoFactorAttempts: { type: Number, select: false }
});

/** Champs jamais renvoyés dans une réponse JSON. */
const HIDDEN = [
  'password',
  'failedLoginAttempts',
  'sessions',
  'passwordResetToken',
  'passwordResetExpires',
  'emailVerificationToken',
  'emailVerificationExpires',
  'twoFactorCode',
  'twoFactorExpires',
  'twoFactorAttempts',
  'webauthnCredentials'
];

function cleanJson(schema) {
  schema.set('toJSON', {
    versionKey: false,
    transform(_doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      for (const field of HIDDEN) delete ret[field];
      return ret;
    }
  });
}

module.exports = { securityFields, cleanJson };
