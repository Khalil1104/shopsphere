'use strict';

const os = require('os');
const mongoose = require('mongoose');
const config = require('./env');

mongoose.set('strictQuery', true);

async function connectDatabase(uri = config.mongoUri) {
  // runtimeAdapters : nécessaire pour le driver MongoDB récent sous Jest.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, runtimeAdapters: { os } });
  // Crée les index uniques (email, CIN) avant d'accepter des requêtes.
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  if (!config.isTest) console.log(`MongoDB connecté (${mongoose.connection.name})`);
}

const disconnectDatabase = () => mongoose.disconnect();

module.exports = { connectDatabase, disconnectDatabase };
