const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema(
  {
    gouvernorat: { type: String, required: [true, 'Le gouvernorat est obligatoire'], unique: true, trim: true },
    frais: { type: Number, required: true, min: [0, 'Les frais doivent être positifs'] },
    delaiJours: { type: Number, required: true, min: [1, 'Le délai minimum est de 1 jour'] },
    seuilGratuit: { type: Number, default: null, min: 0 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Zone', zoneSchema);
