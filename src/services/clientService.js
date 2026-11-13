'use strict';

const AppError = require('../utils/AppError');
const Client = require('../models/Client');
const emailService = require('./emailService');
const { createClient } = require('./authService');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Liste paginée avec recherche (nom, prénom, e-mail, téléphone, CIN) et filtre par statut. */
async function list({ page, limit, search, status }) {
  const filter = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }, { cin: rx }];
  }
  if (status) filter.accountStatus = status;
  const [items, total] = await Promise.all([
    Client.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Client.countDocuments(filter)
  ]);
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function getById(id) {
  const client = await Client.findById(id);
  if (!client) throw AppError.notFound('Client introuvable');
  return client;
}

const create = (data) => createClient(data);

async function update(id, data) {
  const client = await Client.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true });
  if (!client) throw AppError.notFound('Client introuvable');
  return client;
}

/** Suspension / réactivation + e-mail au client. */
async function updateStatus(id, { status, reason }) {
  const before = await getById(id);
  if (before.accountStatus === status) return before;
  const update =
    status === 'SUSPENDED'
      ? { $set: { accountStatus: 'SUSPENDED', statusReason: reason || 'Suspendu par un administrateur', suspendedForFailedLogins: false, sessions: [] } }
      : { $set: { accountStatus: 'ACTIVE', suspendedForFailedLogins: false, failedLoginAttempts: 0 }, $unset: { statusReason: 1 } };
  // Suspension : toutes les sessions sont fermées. Réactivation : le compteur d'échecs repart à 0.
  const client = await Client.findByIdAndUpdate(id, update, { returnDocument: 'after' });
  await emailService.sendStatusChanged(client, status, reason);
  return client;
}

async function remove(id) {
  const client = await Client.findByIdAndDelete(id);
  if (!client) throw AppError.notFound('Client introuvable');
}

module.exports = { list, getById, create, update, updateStatus, remove };
