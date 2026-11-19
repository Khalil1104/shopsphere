const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const User = require('../models/User');

async function promouvoirAdministrateur() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    throw new Error('Définissez ADMIN_EMAIL avant de lancer cette commande.');
  }

  await connectDB();
  try {
    const utilisateur = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { role: 'admin' } },
      { new: true }
    );
    if (!utilisateur) {
      throw new Error('Aucun compte ne correspond à ADMIN_EMAIL. Inscrivez d’abord ce compte.');
    }
    console.log(`Le compte ${utilisateur.email} est maintenant administrateur.`);
  } finally {
    await mongoose.disconnect();
  }
}

promouvoirAdministrateur().catch((error) => {
  console.error('Impossible de promouvoir le compte :', error.message);
  process.exitCode = 1;
});
