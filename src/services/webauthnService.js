'use strict';

const crypto = require('crypto');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const { isoBase64URL, isoUint8Array } = require('@simplewebauthn/server/helpers');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const MemoryStore = require('../utils/memoryStore');
const Admin = require('../models/Admin');
const sessionService = require('./sessionService');
const emailService = require('./emailService');

/**
 * Connexion Face ID / Windows Hello des administrateurs (norme WebAuthn).
 *
 *  Enregistrement (admin déjà connecté, page « Mon compte ») :
 *    1. le serveur envoie un défi aléatoire
 *    2. l'appareil vérifie le visage / l'empreinte et crée une paire de clés
 *    3. le serveur vérifie la réponse et garde la CLÉ PUBLIQUE dans le document admin
 *  Connexion (page de connexion) :
 *    1. nouveau défi
 *    2. l'appareil vérifie le visage et SIGNE le défi avec la clé privée
 *    3. le serveur vérifie la signature avec la clé publique → session ouverte
 *
 * Les défis vivent 5 minutes en mémoire (usage unique) : aucune collection en plus.
 */
const challenges = new MemoryStore({ ttlMs: 5 * 60 * 1000 });
const MAX_DEVICES = 10;
const { rpName, rpId, origin } = config.webauthn;

const withCredentials = (id) => Admin.findById(id).select('+webauthnCredentials');

/** Liste des appareils enregistrés (sans les clés). */
async function list(adminId) {
  const admin = await withCredentials(adminId);
  return (admin ? admin.webauthnCredentials : []).map((c) => ({
    id: c.credentialId,
    name: c.name,
    createdAt: c.createdAt,
    lastUsedAt: c.lastUsedAt
  }));
}

// --------------------------------------------------------------------------- enregistrement
async function registrationOptions(adminId) {
  const admin = await withCredentials(adminId);
  if (!admin) throw AppError.notFound('Compte introuvable');
  if (admin.webauthnCredentials.length >= MAX_DEVICES) throw AppError.badRequest(`${MAX_DEVICES} appareils maximum : supprimez-en un d'abord.`);

  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userName: admin.email,
    userDisplayName: `${admin.firstName} ${admin.lastName}`,
    userID: isoUint8Array.fromUTF8String(String(admin._id)),
    attestationType: 'none',
    excludeCredentials: admin.webauthnCredentials.map((c) => ({ id: c.credentialId, transports: c.transports })),
    // residentKey "required" : la connexion se fait sans taper l'e-mail
    // userVerification "required" : le visage / l'empreinte / le code Windows Hello est obligatoire
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' }
  });
  challenges.set(`reg:${admin._id}`, options.challenge);
  return options;
}

async function verifyRegistration(adminId, response, name) {
  const expectedChallenge = challenges.take(`reg:${adminId}`);
  if (!expectedChallenge) throw AppError.badRequest('Demande expirée : recommencez.');

  let result;
  try {
    result = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: true
    });
  } catch (err) {
    throw AppError.badRequest(`Enregistrement refusé : ${err.message}`);
  }
  if (!result.verified) throw AppError.badRequest('Enregistrement refusé.');

  const { credential } = result.registrationInfo;
  const added = await Admin.findOneAndUpdate(
    { _id: adminId, 'webauthnCredentials.credentialId': { $ne: credential.id } },
    {
      $push: {
        webauthnCredentials: {
          credentialId: credential.id,
          publicKey: isoBase64URL.fromBuffer(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports || [],
          name: String(name || '').trim().slice(0, 60) || 'Cet appareil'
        }
      }
    },
    { returnDocument: 'after' }
  );
  if (!added) throw AppError.conflict('Cet appareil est déjà enregistré.');

  await emailService.sendSecurityNotice(
    added,
    'Nouvel appareil Face ID enregistré',
    `L'appareil « ${String(name || 'Cet appareil').slice(0, 60)} » peut maintenant se connecter au tableau de bord avec Face ID / Windows Hello.`
  );
  return { id: credential.id };
}

async function remove(adminId, credentialId) {
  const res = await Admin.updateOne({ _id: adminId }, { $pull: { webauthnCredentials: { credentialId } } });
  if (res.modifiedCount === 0) throw AppError.notFound('Appareil introuvable');
}

// --------------------------------------------------------------------------- connexion
/** Défi de connexion. "key" identifie le défi (gardé dans un cookie du navigateur). */
async function authenticationOptions() {
  const options = await generateAuthenticationOptions({ rpID: rpId, userVerification: 'required' });
  const key = crypto.randomUUID();
  challenges.set(`auth:${key}`, options.challenge);
  return { key, options };
}

async function verifyAuthentication(key, response, ctx = {}) {
  const expectedChallenge = challenges.take(`auth:${key}`);
  if (!expectedChallenge) throw AppError.badRequest('Demande expirée : recommencez.');
  if (!response || typeof response.id !== 'string') throw AppError.badRequest('Réponse Face ID invalide.');

  const admin = await Admin.findOne({ 'webauthnCredentials.credentialId': response.id }).select('+webauthnCredentials');
  if (!admin) {
    throw AppError.unauthorized('Appareil inconnu : connectez-vous avec le mot de passe, puis enregistrez Face ID dans « Mon compte ».');
  }
  const stored = admin.webauthnCredentials.find((c) => c.credentialId === response.id);

  // L'identifiant d'utilisateur renvoyé par l'appareil doit être celui de ce compte
  const userHandle = response.response && response.response.userHandle;
  if (userHandle && isoUint8Array.toUTF8String(isoBase64URL.toBuffer(userHandle)) !== String(admin._id)) {
    throw AppError.unauthorized('Face ID refusé.');
  }

  let result;
  try {
    result = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: true,
      credential: {
        id: stored.credentialId,
        publicKey: isoBase64URL.toBuffer(stored.publicKey),
        counter: stored.counter,
        transports: stored.transports
      }
    });
  } catch (err) {
    throw AppError.unauthorized(`Face ID refusé : ${err.message}`);
  }
  if (!result.verified) throw AppError.unauthorized('Face ID refusé.');
  if (admin.accountStatus !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Compte suspendu. Contactez un autre administrateur.');

  await Admin.updateOne(
    { _id: admin._id, 'webauthnCredentials.credentialId': stored.credentialId },
    { $set: { 'webauthnCredentials.$.counter': result.authenticationInfo.newCounter, 'webauthnCredentials.$.lastUsedAt': new Date() } }
  );
  const session = await sessionService.open(admin, 'admin', ctx);
  return { token: session.token, expiresAt: session.expiresAt, admin };
}

module.exports = { list, registrationOptions, verifyRegistration, remove, authenticationOptions, verifyAuthentication, _challenges: challenges };
