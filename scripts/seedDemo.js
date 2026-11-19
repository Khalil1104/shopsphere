const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

async function creerDonneesDemo() {
  const email = process.env.CLIENT_EMAIL;
  if (!email) {
    throw new Error('Définissez CLIENT_EMAIL avant de lancer cette commande.');
  }

  await connectDB();
  try {
    const client = await User.findOne({ email: email.toLowerCase(), role: 'client' });
    if (!client) {
      throw new Error('Aucun client trouvé. Inscrivez d’abord le compte indiqué par CLIENT_EMAIL.');
    }

    const product = await Product.create({
      nom: 'Produit de démonstration',
      description: 'Produit utilisé pour tester le module 6.',
      prix: 25
    });
    const order = await Order.create({
      clientId: client._id,
      statut: 'livree',
      produits: [{ productId: product._id, quantite: 1, prixUnitaire: product.prix }]
    });
    console.log(`productId=${product.id}`);
    console.log(`orderId=${order.id}`);
  } finally {
    await mongoose.disconnect();
  }
}

creerDonneesDemo().catch((error) => {
  console.error('Impossible de créer les données de démonstration :', error.message);
  process.exitCode = 1;
});
