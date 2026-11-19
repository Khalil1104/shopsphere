const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    auteurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    auteurRole: { type: String, enum: ['client', 'admin'], required: true },
    texte: { type: String, required: true, trim: true, maxlength: 4000 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ticketSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    sujet: { type: String, required: true, trim: true, maxlength: 160 },
    priorite: { type: String, enum: ['basse', 'normale', 'haute'], default: 'normale', required: true },
    statut: { type: String, enum: ['ouvert', 'en_cours', 'resolu', 'ferme'], default: 'ouvert', required: true },
    messages: { type: [messageSchema], validate: [(messages) => messages.length > 0, 'Un ticket doit contenir au moins un message.'] },
    dernierMessageLe: { type: Date, required: true, default: Date.now, index: true },
    dernierAuteurRole: { type: String, enum: ['client', 'admin'], required: true, default: 'client' },
    rappelEnvoyeLe: { type: Date, default: null }
  },
  { timestamps: true }
);

ticketSchema.index({ statut: 1, dernierAuteurRole: 1, dernierMessageLe: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
