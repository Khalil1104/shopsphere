const mongoose = require('mongoose');

const courierSchema = new mongoose.Schema(
  {
    nom: { type: String, required: [true, 'Le nom est obligatoire'], trim: true },
    telephone: { type: String, required: [true, 'Le téléphone est obligatoire'], trim: true },
    maxLivraisonsParJour: { type: Number, default: 10, min: 1 },
    actif: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Courier', courierSchema);
