require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Ticket = require('../models/Ticket');

// Ids fixes : mêmes valeurs que dans fakeAuth.js et dans Postman
const ID_CLIENT = '000000000000000000000001';
const ID_COMMANDE = '000000000000000000000004';
const ID_PRODUITS = [
  '000000000000000000000003',
  '000000000000000000000005',
  '000000000000000000000006'
];

(async () => {
  await connectDB();

  // On repart de zéro pour les données de test
  await Review.deleteMany({ clientId: ID_CLIENT });
  await Ticket.deleteMany({ clientId: ID_CLIENT });
  await Order.deleteOne({ _id: ID_COMMANDE });
  await Product.deleteMany({ _id: { $in: ID_PRODUITS } });

  // Trois produits, pour pouvoir tester plusieurs avis sans relancer le seed
  for (let i = 0; i < ID_PRODUITS.length; i++) {
    await Product.create({ _id: ID_PRODUITS[i], nom: `Produit test ${i + 1}`, prix: 50 });
  }

  // Une commande livrée qui contient les trois produits
  await Order.create({
    _id: ID_COMMANDE,
    clientId: ID_CLIENT,
    statut: 'livree',
    produits: ID_PRODUITS.map((id) => ({ productId: id, quantite: 1, prixUnitaire: 50 }))
  });

  console.log('Données de test créées :');
  console.log('orderId    =', ID_COMMANDE);
  ID_PRODUITS.forEach((id, i) => console.log(`productId${i + 1} =`, id));

  await mongoose.disconnect();
})().catch((e) => {
  console.error('Erreur seed :', e.message);
  process.exit(1);
});