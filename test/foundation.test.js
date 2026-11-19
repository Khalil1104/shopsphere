const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const app = require('../app');
const { getMongoUri } = require('../config/database');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('la route de santé répond sans connexion à MongoDB', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: 'ShopSphere fonctionne.' });
});

test('la configuration MongoDB utilise une URI locale remplaçable', () => {
  const precedente = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;
  assert.equal(getMongoUri(), 'mongodb://127.0.0.1:27017/shopsphere');
  process.env.MONGODB_URI = 'mongodb://mongo.example/shopsphere';
  assert.equal(getMongoUri(), 'mongodb://mongo.example/shopsphere');
  if (precedente === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = precedente;
});

test('une route inconnue renvoie une erreur JSON en français', async () => {
  const response = await fetch(`${baseUrl}/inconnue`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: 'Ressource introuvable.' });
});

test('les vues Twig admin sont disponibles et un identifiant incorrect est refusé', async () => {
  for (const route of ['/admin/reviews', '/admin/tickets', '/admin/stats']) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
  }
  const detail = await fetch(`${baseUrl}/admin/tickets/invalide`);
  assert.equal(detail.status, 400);
  assert.equal(typeof (await detail.json()).message, 'string');
});

test('un corps invalide à l’inscription est refusé avec un 400', async () => {
  const response = await fetch(`${baseUrl}/api/auth/inscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom: '', email: 'invalide', motDePasse: 'court' })
  });
  assert.equal(response.status, 400);
  assert.equal(typeof (await response.json()).message, 'string');
});
