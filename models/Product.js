const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    prix: { type: Number, required: true, min: 0 },
    noteMoyenne: { type: Number, default: 0, min: 0, max: 5 },
    nombreAvis: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
