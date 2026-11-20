require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const Order = require('../models/Order');

(async () => {
  await connectDB();
  console.log('Base utilisée :', mongoose.connection.name);
  const n = await Order.countDocuments({
    clientId: '000000000000000000000001',
    statut: 'livree',
    'produits.productId': '000000000000000000000003'
  });
  console.log('Commandes livrées du client test :', n);
  await mongoose.disconnect();
})();