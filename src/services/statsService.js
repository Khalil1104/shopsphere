'use strict';

const Client = require('../models/Client');
const Admin = require('../models/Admin');

const TZ = 'Africa/Tunis'; // UTC+1 toute l'année
const DAY = 24 * 3600 * 1000;

/** Minuit (heure de Tunis) du jour courant, en date UTC. */
function startOfTodayTunis() {
  const tunis = new Date(Date.now() + 3600 * 1000);
  return new Date(Date.UTC(tunis.getUTCFullYear(), tunis.getUTCMonth(), tunis.getUTCDate()) - 3600 * 1000);
}

/** Nombre de sessions non expirées dans une collection (somme des tableaux "sessions"). */
async function activeSessions(Model) {
  const now = new Date();
  const [row] = await Model.aggregate([
    { $project: { n: { $size: { $filter: { input: { $ifNull: ['$sessions', []] }, cond: { $gt: ['$$this.expiresAt', now] } } } } } },
    { $group: { _id: null, total: { $sum: '$n' } } }
  ]);
  return row ? row.total : 0;
}

/**
 * Tableau de bord chiffré pour l'administrateur.
 * Tout est calculé à partir des 2 collections (clients, admins) avec des requêtes d'agrégation MongoDB.
 */
async function overview({ days = 7 } = {}) {
  const today = startOfTodayTunis();
  const from = new Date(today.getTime() - (days - 1) * DAY);

  const [clientCounts] = await Client.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        verified: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
        active: { $sum: { $cond: [{ $eq: ['$accountStatus', 'ACTIVE'] }, 1, 0] } },
        suspended: { $sum: { $cond: [{ $eq: ['$accountStatus', 'SUSPENDED'] }, 1, 0] } },
        suspendedForFailedLogins: { $sum: { $cond: ['$suspendedForFailedLogins', 1, 0] } },
        newToday: { $sum: { $cond: [{ $gte: ['$createdAt', today] }, 1, 0] } },
        loginsToday: { $sum: { $cond: [{ $gte: ['$lastLoginAt', today] }, 1, 0] } }
      }
    }
  ]);
  const c = clientCounts || { total: 0, verified: 0, active: 0, suspended: 0, suspendedForFailedLogins: 0, newToday: 0, loginsToday: 0 };

  const [adminTotal, adminActive, adminLoginsToday, clientSessions, adminSessions, perDayRows, cityRows] = await Promise.all([
    Admin.countDocuments(),
    Admin.countDocuments({ accountStatus: 'ACTIVE' }),
    Admin.countDocuments({ lastLoginAt: { $gte: today } }),
    activeSessions(Client),
    activeSessions(Admin),
    Client.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, count: { $sum: 1 } } }
    ]),
    Client.aggregate([
      { $match: { city: { $nin: [null, ''] } } },
      { $group: { _id: { $toLower: '$city' }, city: { $first: '$city' }, count: { $sum: 1 } } },
      { $sort: { count: -1, city: 1 } },
      { $limit: 5 }
    ])
  ]);

  // Inscriptions par jour, en incluant les jours à 0
  const counts = Object.fromEntries(perDayRows.map((r) => [r._id, r.count]));
  const registrationsPerDay = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(from.getTime() + i * DAY + 3600 * 1000).toISOString().slice(0, 10);
    registrationsPerDay.push({ date, count: counts[date] || 0 });
  }

  const pct = (part, total) => (total ? Math.round((part / total) * 1000) / 10 : 0);

  return {
    generatedAt: new Date(),
    clients: {
      total: c.total,
      verified: c.verified,
      unverified: c.total - c.verified,
      verifiedRate: pct(c.verified, c.total),
      active: c.active,
      suspended: c.suspended,
      suspendedForFailedLogins: c.suspendedForFailedLogins,
      newToday: c.newToday,
      newLast7Days: registrationsPerDay.slice(-7).reduce((sum, d) => sum + d.count, 0)
    },
    admins: { total: adminTotal, active: adminActive, suspended: adminTotal - adminActive },
    sessions: { active: clientSessions + adminSessions, clients: clientSessions, admins: adminSessions },
    loginsToday: { clients: c.loginsToday, admins: adminLoginsToday },
    registrationsPerDay,
    topCities: cityRows.map((r) => ({ city: r.city, count: r.count }))
  };
}

module.exports = { overview };
