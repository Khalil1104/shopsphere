const mongoose = require('mongoose');
const app = require('./app');
const { planifierRappels } = require('./jobs/ticketReminders');

const port = Number(process.env.PORT) || 3000;

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error('La variable MONGODB_URI est obligatoire.');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('La variable JWT_SECRET est obligatoire.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  planifierRappels();
  app.listen(port, () => {
    console.log(`ShopSphere écoute sur le port ${port}.`);
  });
}

start().catch((error) => {
  console.error('Impossible de démarrer ShopSphere :', error.message);
  process.exitCode = 1;
});
