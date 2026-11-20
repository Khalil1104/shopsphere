require('dotenv').config();
const mongoose = require('mongoose');
const cfg = require('../config/dbconnection.json');
const Zone = require('../models/Zone');
const Courier = require('../models/Courier');
const Delivery = require('../models/Delivery');

const zones = [
  { gouvernorat: 'Tunis', frais: 5, delaiJours: 1, seuilGratuit: 100 },
  { gouvernorat: 'Ariana', frais: 5, delaiJours: 1, seuilGratuit: 100 },
  { gouvernorat: 'Ben Arous', frais: 6, delaiJours: 2, seuilGratuit: 120 },
  { gouvernorat: 'Nabeul', frais: 8, delaiJours: 2, seuilGratuit: 150 },
  { gouvernorat: 'Sousse', frais: 9, delaiJours: 3, seuilGratuit: 150 },
  { gouvernorat: 'Sfax', frais: 10, delaiJours: 3, seuilGratuit: 200 }
];

const couriers = [
  { nom: 'Ahmed Ben Salah', telephone: '20123456', maxLivraisonsParJour: 2 },
  { nom: 'Sami Trabelsi', telephone: '21234567', maxLivraisonsParJour: 10 },
  { nom: 'Rim Gharbi', telephone: '22345678', maxLivraisonsParJour: 8 }
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || cfg.url);
    await Promise.all([Zone.deleteMany({}), Courier.deleteMany({}), Delivery.deleteMany({})]);
    await Zone.insertMany(zones);
    await Courier.insertMany(couriers);
    console.log(`Seed : ${zones.length} zones, ${couriers.length} livreurs`);
  } catch (e) {
    console.error('Erreur seed :', e.message);
  } finally {
    await mongoose.disconnect();
  }
})();
