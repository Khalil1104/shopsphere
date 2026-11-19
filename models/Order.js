const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    statut: {
      type: String,
      enum: ['en_attente', 'en_preparation', 'expediee', 'livree', 'annulee'],
      default: 'en_attente',
      required: true
    },
    produits: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantite: { type: Number, required: true, min: 1 },
        prixUnitaire: { type: Number, required: true, min: 0 }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
