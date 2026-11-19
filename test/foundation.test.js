const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const app = require('../app');

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

test('une route inconnue renvoie une erreur JSON en français', async () => {
  const response = await fetch(`${baseUrl}/inconnue`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: 'Ressource introuvable.' });
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
