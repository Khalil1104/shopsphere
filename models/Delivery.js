const mongoose = require('mongoose');

const STATUTS = ['en_preparation', 'expediee', 'en_transit', 'livree', 'echec'];

const adresseSchema = new mongoose.Schema(
  {
    rue: { type: String, required: true, trim: true },
    ville: { type: String, required: true, trim: true },
    gouvernorat: { type: String, required: true, trim: true },
    codePostal: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const historiqueSchema = new mongoose.Schema(
  {
    statut: { type: String, enum: STATUTS, required: true },
    date: { type: Date, default: Date.now },
    commentaire: { type: String, default: '' }
  },
  { _id: false }
);

const deliverySchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    adresse: { type: adresseSchema, required: true },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    frais: { type: Number, required: true, min: 0 },
    courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Courier', default: null },
    statut: { type: String, enum: STATUTS, default: 'en_preparation', index: true },
    datePrevue: { type: Date, required: true },
    dateReelle: { type: Date, default: null },
    historique: { type: [historiqueSchema], default: [] }
  },
  { timestamps: true }
);

deliverySchema.index({ courierId: 1, datePrevue: 1 });
deliverySchema.index({ 'adresse.gouvernorat': 1 });

module.exports = mongoose.model('Delivery', deliverySchema);
