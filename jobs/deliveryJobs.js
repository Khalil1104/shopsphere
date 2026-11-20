const cron = require('node-cron');
const { alerterRetards } = require('../services/notifications');

// Tous les jours à 9h : alerte les admins pour les livraisons en retard
const startDeliveryJobs = () => {
  cron.schedule('0 9 * * *', async () => {
    try {
      const n = await alerterRetards();
      console.log(`[CRON] Retards de livraison signalés : ${n}`);
    } catch (e) {
      console.error('[CRON] Erreur alerte retards :', e.message);
    }
  });
};

module.exports = { startDeliveryJobs };
