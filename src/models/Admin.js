'use strict';

const mongoose = require('mongoose');
const { securityFields, cleanJson } = require('./accountFields');

/**
 * Appareil enregistré pour la connexion Face ID / Windows Hello (WebAuthn).
 * On garde seulement la CLÉ PUBLIQUE : la clé privée ne quitte jamais l'appareil.
 */
const credentialSchema = new mongoose.Schema(
  {
    credentialId: { type: String, required: true }, // base64url
    publicKey: { type: String, required: true }, // base64url
    counter: { type: Number, default: 0 }, // compteur de signatures (détecte un clone)
    transports: { type: [String], default: [] },
    name: { type: String, trim: true, maxlength: 60 },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date }
  },
  { _id: false }
);

/** Collection "admins" : séparée des clients. */
const adminSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true, select: false }, // hash bcrypt
    phone: { type: String, trim: true },
    role: { type: String, enum: ['ADMIN'], default: 'ADMIN', immutable: true },

    ...securityFields(), // statut, suspension auto, sessions, mot de passe oublié, 2FA

    webauthnCredentials: { type: [credentialSchema], default: [], select: false } // Face ID
  },
  { timestamps: true, collection: 'admins' }
);

adminSchema.index({ 'webauthnCredentials.credentialId': 1 }); // retrouver l'admin à partir de son appareil
cleanJson(adminSchema);

module.exports = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
