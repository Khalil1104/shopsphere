'use strict';

const mongoose = require('mongoose');
const { securityFields, cleanJson } = require('./accountFields');

/**
 * Collection "clients".
 * Les champs sensibles (mot de passe, jetons, sessions) ont select:false : ils ne sortent
 * jamais d'une requête sauf si on les demande explicitement (.select('+password')).
 */
const clientSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true, select: false }, // hash bcrypt
    phone: { type: String, trim: true },
    cin: { type: String, required: true, trim: true, unique: true }, // 8 chiffres
    dateOfBirth: { type: Date },
    address: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    role: { type: String, enum: ['CUSTOMER'], default: 'CUSTOMER', immutable: true },

    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false }, // hash SHA-256
    emailVerificationExpires: { type: Date, select: false },
    verificationReminderSentAt: { type: Date }, // automation "Rappel de vérification"

    ...securityFields() // statut, suspension auto, sessions, mot de passe oublié
  },
  { timestamps: true, collection: 'clients' }
);

cleanJson(clientSchema);

module.exports = mongoose.models.Client || mongoose.model('Client', clientSchema);
