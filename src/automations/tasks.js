'use strict';

const config = require('../config/env');
const Client = require('../models/Client');
const Admin = require('../models/Admin');
const emailService = require('../services/emailService');
const statsService = require('../services/statsService');
const { generateToken, hashToken } = require('../utils/security');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/**
 * Les 4 automations. Chaque tâche :
 *  - type "daily"   : lancée une fois par jour à l'heure "time" (heure de Tunis)
 *  - type "trigger" : lancée par un événement (ex. compte suspendu)
 *  - run(payload)   : fait le travail et renvoie un résumé lisible
 */
const tasks = [
  {
    key: 'verification-reminder',
    name: 'Rappel de vérification',
    description: 'Clients non vérifiés après 24 h.',
    type: 'daily',
    time: '10:00',
    defaultEnabled: true,
    async run() {
      const clients = await Client.find({
        isEmailVerified: false,
        accountStatus: 'ACTIVE',
        createdAt: { $lte: new Date(Date.now() - 24 * HOUR) },
        verificationReminderSentAt: { $exists: false }
      }).limit(200);
      for (const client of clients) {
        const token = generateToken();
        await Client.updateOne(
          { _id: client._id },
          {
            $set: {
              emailVerificationToken: hashToken(token),
              emailVerificationExpires: new Date(Date.now() + config.emailVerificationHours * HOUR),
              verificationReminderSentAt: new Date()
            }
          }
        );
        await emailService.sendVerificationReminder(client, token);
      }
      return { count: clients.length, summary: clients.length ? `${clients.length} rappel(s) envoyé(s)` : 'Aucun client à relancer' };
    }
  },
  {
    key: 'daily-report',
    name: 'Rapport quotidien',
    description: 'Résumé envoyé aux administrateurs.',
    type: 'daily',
    time: '08:00',
    defaultEnabled: true,
    async run() {
      const stats = await statsService.overview({ days: 7 });
      const admins = await Admin.find({ accountStatus: 'ACTIVE' });
      for (const admin of admins) await emailService.sendDailyReport(admin, stats);
      return { count: admins.length, summary: `Rapport envoyé à ${admins.length} administrateur(s)` };
    }
  },
  {
    key: 'cleanup-unverified',
    name: 'Nettoyage des comptes non vérifiés',
    description: 'Comptes non vérifiés depuis 7 jours.',
    type: 'daily',
    time: '03:00',
    defaultEnabled: false,
    async run() {
      const res = await Client.deleteMany({ isEmailVerified: false, createdAt: { $lte: new Date(Date.now() - 7 * DAY) } });
      return { count: res.deletedCount, summary: res.deletedCount ? `${res.deletedCount} compte(s) supprimé(s)` : 'Aucun compte à supprimer' };
    }
  },
  {
    key: 'security-alert',
    name: 'Alerte sécurité',
    description: 'Compte suspendu après 5 échecs.',
    type: 'trigger',
    trigger: 'À chaque suspension',
    defaultEnabled: true,
    async run(payload) {
      if (!payload) return { count: 0, summary: 'Se déclenche automatiquement à chaque suspension' };
      const admins = await Admin.find({ accountStatus: 'ACTIVE', email: { $ne: payload.email } });
      for (const admin of admins) await emailService.sendSecurityAlert(admin, payload);
      return { count: admins.length, summary: `${payload.type === 'admin' ? 'Admin' : 'Client'} ${payload.email} suspendu — ${admins.length} admin(s) prévenu(s)` };
    }
  }
];

module.exports = tasks;
