'use strict';

/**
 * Données de démonstration pour le tableau de bord : ~30 clients fictifs (@example.com)
 * répartis sur 30 jours, dans plusieurs villes, avec des statuts variés.
 * Aucun e-mail n'est envoyé. Relancer le script remplace les clients de démo existants.
 *
 *   npm run demo:seed
 */
const mongoose = require('mongoose');
const { connectDatabase } = require('../src/config/database');
const Client = require('../src/models/Client');
const { hashPassword } = require('../src/utils/security');

const FIRST = ['Amira', 'Youssef', 'Leila', 'Omar', 'Sarra', 'Mehdi', 'Ines', 'Hamza', 'Rania', 'Aziz', 'Nour', 'Karim', 'Yasmine', 'Bilel', 'Salma', 'Anis', 'Mariem', 'Fares', 'Hiba', 'Walid', 'Eya', 'Skander', 'Asma', 'Ghassen', 'Chaima', 'Ahmed', 'Rim', 'Seif', 'Olfa', 'Tarek'];
const LAST = ['Trabelsi', 'Ben Salah', 'Gharbi', 'Jaziri', 'Mansouri', 'Chaabane', 'Hammami', 'Ayari', 'Bouzid', 'Khelifi', 'Dridi', 'Saidi', 'Mejri', 'Ferchichi', 'Belhaj'];
const CITIES = ['Tunis', 'Tunis', 'Tunis', 'Sfax', 'Sfax', 'Sousse', 'Sousse', 'Ariana', 'Nabeul', 'Bizerte', 'Monastir', 'Gabès'];
const DAY = 24 * 3600 * 1000;
const pick = (arr, i) => arr[i % arr.length];

(async () => {
  await connectDatabase();
  await Client.deleteMany({ email: /@example\.com$/ });
  const password = await hashPassword('Demo2026Pass');
  const docs = FIRST.map((first, i) => {
    const last = pick(LAST, i * 7);
    // plus d'inscriptions récentes que d'anciennes, réparties sur 30 jours
    const daysAgo = [0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 5, 5, 6, 6, 8, 9, 11, 12, 13, 15, 17, 18, 20, 22, 23, 25, 26, 28, 29][i];
    const createdAt = new Date(Date.now() - daysAgo * DAY - (i % 9) * 3600 * 1000);
    const verified = i % 4 !== 1;
    const suspended = i % 11 === 5;
    const failed = i === 16;
    const loggedRecently = verified && !suspended && i % 3 !== 2;
    return {
      firstName: first,
      lastName: last,
      email: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + `${i}@example.com`,
      password,
      phone: `+2162${String(1000000 + i * 7919).slice(0, 7)}`,
      cin: String(10000000 + i * 271828).slice(0, 8),
      city: pick(CITIES, i * 5),
      address: `${10 + i} rue de la République`,
      isEmailVerified: verified,
      accountStatus: suspended || failed ? 'SUSPENDED' : 'ACTIVE',
      suspendedForFailedLogins: failed,
      statusReason: failed ? '5 tentatives de connexion échouées' : suspended ? 'Commande frauduleuse signalée' : undefined,
      lastLoginAt: loggedRecently ? new Date(Date.now() - (i % 5) * 3 * 3600 * 1000) : undefined,
      createdAt,
      updatedAt: createdAt
    };
  });
  await Client.insertMany(docs, { timestamps: false });
  console.log(`${docs.length} clients de démonstration créés (mot de passe : Demo2026Pass).`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
