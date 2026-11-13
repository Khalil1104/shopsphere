'use strict';

const mongoose = require('mongoose');
const { securityFields, cleanJson } = require('./accountFields');

/** Collection "admins" : séparée des clients. */
const adminSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true, select: false }, // hash bcrypt
    phone: { type: String, trim: true },
    role: { type: String, enum: ['ADMIN'], default: 'ADMIN', immutable: true },

    ...securityFields() // statut, suspension auto, sessions, mot de passe oublié
  },
  { timestamps: true, collection: 'admins' }
);

cleanJson(adminSchema);

module.exports = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
