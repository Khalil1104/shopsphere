require('dotenv').config();

const mongoose = require('mongoose');

const uriLocale = 'mongodb://127.0.0.1:27017/shopsphere';

function getMongoUri() {
  return process.env.MONGODB_URI || uriLocale;
}

async function connectDB() {
  await mongoose.connect(getMongoUri());
  console.log('Connexion MongoDB établie.');
}

module.exports = { connectDB, getMongoUri };
