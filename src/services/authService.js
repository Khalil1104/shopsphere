'use strict';

const config = require('../config/env');
const AppError = require('../utils/AppError');
const Client = require('../models/Client');
const Admin = require('../models/Admin');
const emailService = require('./emailService');
const sessionService = require('./sessionService');
const automations = require('../automations');
const { hashPassword, comparePassword, generateToken, hashToken } = require('../utils/security');

const modelFor = (type) => (type === 'admin' ? Admin : Client);

/** Crée un jeton de vérification : le clair part par e-mail, le hash va en base. */
function newVerificationToken() {
  const token = generateToken();
  return {
    token,
    fields: {
      emailVerificationToken: hashToken(token),
      emailVerificationExpires: new Date(Date.now() + config.emailVerificationHours * 3600 * 1000)
    }
  };
}

/** Crée un jeton "mot de passe oublié" pour un compte et le renvoie en clair (pour l'e-mail). */
async function issueResetToken(Model, userId) {
  const token = generateToken();
  await Model.updateOne(
    { _id: userId },
    { $set: { passwordResetToken: hashToken(token), passwordResetExpires: new Date(Date.now() + config.passwordResetMinutes * 60000) } }
  );
  return token;
}

/** Création d'un client (inscription ou par un admin) + e-mails de bienvenue et de vérification. */
async function createClient(data) {
  const { confirmPassword, ...fields } = data;
  const verification = newVerificationToken();
  const client = await Client.create({
    ...fields,
    password: await hashPassword(fields.password),
    isEmailVerified: false,
    ...verification.fields
  }); // e-mail ou CIN déjà utilisé → erreur 11000 → 409 (errorHandler)

  await emailService.sendWelcome(client);
  await emailService.sendVerification(client, verification.token);
  return client;
}

/**
 * Mot de passe faux : compteur +1 (de façon atomique).
 * Au 5e échec (MAX_FAILED_LOGINS) le compte est SUSPENDU automatiquement,
 * toutes ses sessions sont fermées et un e-mail avec un lien de réactivation est envoyé.
 * @returns {boolean} true si le compte vient d'être suspendu
 */
async function registerFailedLogin(Model, user) {
  const updated = await Model.findOneAndUpdate(
    { _id: user._id, accountStatus: 'ACTIVE' },
    { $inc: { failedLoginAttempts: 1 } },
    { returnDocument: 'after' }
  ).select('+failedLoginAttempts');
  if (!updated || updated.failedLoginAttempts < config.maxFailedLogins) return false;

  await Model.updateOne(
    { _id: user._id },
    {
      $set: {
        accountStatus: 'SUSPENDED',
        suspendedForFailedLogins: true,
        statusReason: `${config.maxFailedLogins} tentatives de connexion échouées`,
        failedLoginAttempts: 0,
        sessions: []
      }
    }
  );
  const type = Model === Admin ? 'admin' : 'client';
  const resetToken = await issueResetToken(Model, user._id);
  await emailService.sendAutoSuspended(user, resetToken, type);
  automations.emit('account.autoSuspended', { type, id: String(user._id), email: user.email, name: `${user.firstName} ${user.lastName}`, at: new Date() });
  return true;
}

/**
 * Connexion (client ou admin).
 * Même message si l'e-mail ou le mot de passe est faux : on ne révèle pas quels e-mails sont inscrits.
 */
async function login(type, { email, password }, ctx = {}) {
  const Model = modelFor(type);
  const user = await Model.findOne({ email }).select('+password');
  if (!user) throw AppError.unauthorized('E-mail ou mot de passe incorrect');

  if (!(await comparePassword(password, user.password))) {
    if (await registerFailedLogin(Model, user)) {
      throw new AppError(
        403,
        'ACCOUNT_SUSPENDED',
        `Compte suspendu après ${config.maxFailedLogins} tentatives échouées. Un e-mail avec un lien de réactivation vous a été envoyé.`
      );
    }
    throw AppError.unauthorized('E-mail ou mot de passe incorrect');
  }

  if (user.accountStatus !== 'ACTIVE') {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', user.suspendedForFailedLogins
      ? 'Compte suspendu après trop de tentatives. Utilisez le lien reçu par e-mail (ou « Mot de passe oublié ») pour le réactiver.'
      : 'Compte suspendu. Contactez le support.');
  }

  const session = await sessionService.open(user, type, ctx);
  return { token: session.token, sessionId: session.sid, expiresAt: session.expiresAt, user };
}

/** Le lien de l'e-mail contient le jeton : on le compare au hash stocké. */
async function verifyEmail(token) {
  const client = await Client.findOne({
    emailVerificationToken: hashToken(token),
    emailVerificationExpires: { $gt: new Date() }
  });
  if (!client) throw AppError.badRequest('Lien invalide, expiré ou déjà utilisé');
  client.isEmailVerified = true;
  client.emailVerificationToken = undefined;
  client.emailVerificationExpires = undefined;
  await client.save();
  return client;
}

/** Renvoi du lien. Réponse identique que le compte existe ou non. */
async function resendVerification(email) {
  const client = await Client.findOne({ email });
  if (!client || client.isEmailVerified) return;
  const verification = newVerificationToken();
  await Client.updateOne({ _id: client._id }, { $set: verification.fields });
  await emailService.sendVerification(client, verification.token);
}

/**
 * Mot de passe oublié : e-mail avec un lien valable 30 min. Réponse identique dans tous les cas.
 * Fonctionne aussi pour un compte suspendu après 5 échecs (c'est le moyen de le réactiver),
 * mais pas pour un compte suspendu par un administrateur.
 */
async function forgotPassword({ email, type }) {
  const Model = modelFor(type);
  const user = await Model.findOne({ email });
  if (!user || (user.accountStatus !== 'ACTIVE' && !user.suspendedForFailedLogins)) return;
  const token = await issueResetToken(Model, user._id);
  await emailService.sendPasswordReset(user, token, type);
}

/** Nouveau mot de passe : ferme toutes les sessions et réactive un compte suspendu après 5 échecs. */
async function resetPassword({ token, password, type }) {
  const Model = modelFor(type);
  const user = await Model.findOne({ passwordResetToken: hashToken(token), passwordResetExpires: { $gt: new Date() } });
  if (!user) throw AppError.badRequest('Lien invalide, expiré ou déjà utilisé');

  const set = { password: await hashPassword(password), failedLoginAttempts: 0, sessions: [] };
  const unset = { passwordResetToken: 1, passwordResetExpires: 1 };
  if (user.suspendedForFailedLogins) {
    set.accountStatus = 'ACTIVE';
    set.suspendedForFailedLogins = false;
    unset.statusReason = 1;
  }
  await Model.updateOne({ _id: user._id }, { $set: set, $unset: unset });
  return { user, reactivated: user.suspendedForFailedLogins };
}

module.exports = { createClient, login, verifyEmail, resendVerification, forgotPassword, resetPassword };
