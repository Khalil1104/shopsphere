'use strict';

const Joi = require('joi');

// --- Briques réutilisables ----------------------------------------------------
const name = Joi.string().trim().min(2).max(50).pattern(/^[\p{L}][\p{L}' -]*$/u)
  .messages({ 'string.pattern.base': '{{#label}} ne doit contenir que des lettres' });
const email = Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(254);
const password = Joi.string().min(8).max(72)
  .pattern(/[a-z]/, 'minuscule').pattern(/[A-Z]/, 'majuscule').pattern(/[0-9]/, 'chiffre')
  .messages({ 'string.pattern.name': 'Le mot de passe doit contenir au moins une {#name}' });
const phone = Joi.string().trim().pattern(/^\+?[0-9]{8,15}$/)
  .messages({ 'string.pattern.base': 'Numéro de téléphone invalide (8 à 15 chiffres)' });
const cin = Joi.string().trim().pattern(/^[0-9]{8}$/)
  .messages({ 'string.pattern.base': 'Le CIN doit contenir exactement 8 chiffres' });
const id = Joi.string().hex().length(24).messages({ 'string.hex': 'Identifiant invalide', 'string.length': 'Identifiant invalide' });
const status = Joi.string().valid('ACTIVE', 'SUSPENDED');
const token = Joi.string().hex().length(64).messages({ 'string.hex': 'Lien invalide', 'string.length': 'Lien invalide' });
const confirmOf = (field) => Joi.any().valid(Joi.ref(field)).required().messages({ 'any.only': 'Les mots de passe ne correspondent pas' });
const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(100).allow(''),
  status
});

const clientFields = {
  firstName: name,
  lastName: name,
  phone,
  dateOfBirth: Joi.date().iso().less('now'),
  address: Joi.string().trim().max(200).allow(''),
  city: Joi.string().trim().max(100).allow('')
};

// --- Authentification ---------------------------------------------------------
const auth = {
  register: {
    body: Joi.object({
      ...clientFields,
      firstName: name.required(),
      lastName: name.required(),
      email: email.required(),
      password: password.required(),
      confirmPassword: confirmOf('password'),
      cin: cin.required()
    })
  },
  login: { body: Joi.object({ email: email.required(), password: Joi.string().required() }) },
  verifyEmail: { query: Joi.object({ token: token.required() }) },
  sessionId: { params: Joi.object({ sid: Joi.string().guid({ version: 'uuidv4' }).required().messages({ 'string.guid': 'Identifiant de session invalide' }) }) },
  emailOnly: { body: Joi.object({ email: email.required() }) },
  forgotPassword: { body: Joi.object({ email: email.required(), type: Joi.string().valid('client', 'admin').default('client') }) },
  resetPassword: {
    body: Joi.object({
      token: token.required(),
      password: password.required(),
      confirmPassword: confirmOf('password'),
      type: Joi.string().valid('client', 'admin').default('client')
    })
  },
  twoFactorVerify: {
    body: Joi.object({
      challengeToken: Joi.string().max(2000).required(),
      code: Joi.string().trim().pattern(/^[0-9]{6}$/).required().messages({ 'string.pattern.base': 'Le code contient 6 chiffres' })
    })
  },
  twoFactorToggle: { body: Joi.object({ password: Joi.string().max(72).required() }) }
};

// --- Clients --------------------------------------------------------------------
const clients = {
  list: { query: listQuery },
  byId: { params: Joi.object({ id: id.required() }) },
  create: {
    body: Joi.object({
      ...clientFields,
      firstName: name.required(),
      lastName: name.required(),
      email: email.required(),
      password: password.required(),
      cin: cin.required()
    })
  },
  update: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({ ...clientFields, email, cin }).min(1)
  },
  updateMe: { body: Joi.object(clientFields).min(1) },
  status: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({ status: status.required(), reason: Joi.string().trim().max(300).allow('') })
  }
};

// --- Admins ---------------------------------------------------------------------
const admins = {
  list: { query: listQuery },
  byId: { params: Joi.object({ id: id.required() }) },
  create: {
    body: Joi.object({
      firstName: name.required(),
      lastName: name.required(),
      email: email.required(),
      password: password.required(),
      phone
    })
  },
  update: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({ firstName: name, lastName: name, email, phone, accountStatus: status }).min(1)
  },
  updateMe: { body: Joi.object({ firstName: name, lastName: name, phone }).min(1) }
};

module.exports = { auth, clients, admins };
