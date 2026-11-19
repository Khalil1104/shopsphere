const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const controller = require('../controller/ticketController');

test('Ticket contient ses statuts, priorités et messages auteur', () => {
  const ticket = new Ticket({
    clientId: new mongoose.Types.ObjectId(),
    orderId: new mongoose.Types.ObjectId(),
    sujet: 'Livraison',
    messages: [{ auteurId: new mongoose.Types.ObjectId(), auteurRole: 'client', texte: 'Où est mon colis ?' }]
  });
  assert.equal(ticket.statut, 'ouvert');
  assert.equal(ticket.priorite, 'normale');
  assert.equal(ticket.messages[0].auteurRole, 'client');
  assert.equal(ticket.validateSync(), undefined);
});

test('un ticket fermé refuse tout nouveau message avec un 409', async () => {
  const ancienneRecherche = Ticket.findOne;
  const ticket = {
    statut: 'ferme',
    messages: { push() { assert.fail('Aucun message ne doit être ajouté.'); } }
  };
  Ticket.findOne = async () => ticket;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  try {
    await controller.ajouterMessage(
      {
        user: { id: new mongoose.Types.ObjectId().toString(), role: 'client' },
        validated: {
          params: { ticketId: new mongoose.Types.ObjectId().toString() },
          body: { texte: 'Je relance' }
        }
      },
      res
    );
    assert.equal(res.statusCode, 409);
    assert.equal(typeof res.body.message, 'string');
  } finally {
    Ticket.findOne = ancienneRecherche;
  }
});

test('le cron de rappel est quotidien à 9 heures', () => {
  const cron = require('node-cron');
  const ancienSchedule = cron.schedule;
  let expression;
  cron.schedule = (value) => { expression = value; return {}; };
  try {
    require('../jobs/ticketReminders').planifierRappels();
    assert.equal(expression, '0 9 * * *');
  } finally {
    cron.schedule = ancienSchedule;
  }
});
