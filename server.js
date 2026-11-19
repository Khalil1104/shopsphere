const app = require('./app');
const { connectDB } = require('./config/database');
const { planifierRappels } = require('./jobs/ticketReminders');

const port = Number(process.env.PORT) || 3000;

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error('La variable JWT_SECRET est obligatoire.');
  }

  await connectDB();
  planifierRappels();
  app.listen(port, () => {
    console.log(`ShopSphere écoute sur le port ${port}.`);
  });
}

start().catch((error) => {
  console.error('Impossible de démarrer ShopSphere :', error.message);
  process.exitCode = 1;
});
