const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['client', 'admin'], default: 'client', required: true }
  },
  { timestamps: true }
);

userSchema.methods.verifierMotDePasse = function verifierMotDePasse(motDePasse) {
  return bcrypt.compare(motDePasse, this.passwordHash);
};

userSchema.statics.creerAvecMotDePasse = async function creerAvecMotDePasse(donnees) {
  const passwordHash = await bcrypt.hash(donnees.motDePasse, 12);
  return this.create({
    nom: donnees.nom,
    email: donnees.email,
    passwordHash,
    role: 'client'
  });
};

module.exports = mongoose.model('User', userSchema);
