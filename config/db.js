const mongoose = require('mongoose');
const cfg = require('./dbconnection.json');

module.exports = async () => {
  await mongoose.connect(process.env.MONGODB_URI || cfg.url);
  console.log('MongoDB connecté');
};
