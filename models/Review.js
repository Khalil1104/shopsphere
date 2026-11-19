const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    note: { type: Number, required: true, min: 1, max: 5 },
    commentaire: { type: String, required: true, trim: true, maxlength: 2000 },
    statut: { type: String, enum: ['en_attente', 'valide', 'masque'], default: 'en_attente', required: true }
  },
  { timestamps: true }
);

reviewSchema.index({ productId: 1, clientId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
