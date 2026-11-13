'use strict';

const config = require('./config/env');
const { connectDatabase } = require('./config/database');
const { verifySmtp } = require('./services/emailService');
const { createApp } = require('./app');
const automations = require('./automations');

async function start() {
  await connectDatabase();
  verifySmtp();
  createApp().listen(config.port, () => {
    console.log(`Serveur démarré sur ${config.appUrl}`);
    console.log(`Tableau de bord : ${config.appUrl}/admin`);
  });
  automations.start();
}

start().catch((err) => {
  console.error(`Démarrage impossible : ${err.message}`);
  process.exit(1);
});
