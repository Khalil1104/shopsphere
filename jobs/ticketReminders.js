const cron = require('node-cron');
const Ticket = require('../models/Ticket');

async function traiterRappels(maintenant = new Date()) {
  const seuil = new Date(maintenant.getTime() - 48 * 60 * 60 * 1000);
  const tickets = await Ticket.find({
    statut: { $in: ['ouvert', 'en_cours'] },
    dernierAuteurRole: 'client',
    dernierMessageLe: { $lte: seuil },
    $or: [
      { rappelEnvoyeLe: null },
      { $expr: { $lt: ['$rappelEnvoyeLe', '$dernierMessageLe'] } }
    ]
  }).select('_id clientId orderId dernierMessageLe');

  for (const ticket of tickets) {
    console.log(`Rappel support : ticket ${ticket.id}, client ${ticket.clientId}, commande ${ticket.orderId}.`);
    await Ticket.updateOne(
      { _id: ticket._id, dernierMessageLe: ticket.dernierMessageLe, dernierAuteurRole: 'client' },
      { $set: { rappelEnvoyeLe: maintenant } }
    );
  }
  return tickets.length;
}

function planifierRappels() {
  return cron.schedule('0 9 * * *', () => {
    traiterRappels().catch((error) => {
      console.error('Échec du traitement des rappels de tickets :', error);
    });
  });
}

module.exports = { traiterRappels, planifierRappels };
