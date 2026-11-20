const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { after, before, test } = require('node:test');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB } = require('../config/database');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

const userIds = [];
const orderIds = [];
const productIds = [];
let server;
let baseUrl;
let clientToken;
let adminToken;
let clientId;
let otherClientToken;
let productId;
let orderId;
let suffixe;

async function requete(route, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const donnees = await response.json();
  return { response, donnees };
}

async function inscription(email) {
  const { response, donnees } = await requete('/api/auth/inscription', {
    method: 'POST',
    body: { nom: 'Client CRUD', email, motDePasse: 'Motdepasse123' }
  });
  assert.equal(response.status, 201);
  return donnees;
}

before(async () => {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await connectDB();
  await Promise.all([Review.init(), Ticket.init()]);

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  suffixe = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const client = await inscription(`client-${suffixe}@example.com`);
  clientToken = client.token;
  clientId = client.utilisateur.id;
  userIds.push(new mongoose.Types.ObjectId(clientId));

  const autreClient = await inscription(`autre-${suffixe}@example.com`);
  otherClientToken = autreClient.token;
  userIds.push(new mongoose.Types.ObjectId(autreClient.utilisateur.id));

  const admin = await User.creerAvecMotDePasse({
    nom: 'Admin CRUD',
    email: `admin-${suffixe}@example.com`,
    motDePasse: 'Motdepasse123'
  });
  admin.role = 'admin';
  await admin.save();
  userIds.push(admin._id);

  const connexionAdmin = await requete('/api/auth/connexion', {
    method: 'POST',
    body: { email: admin.email, motDePasse: 'Motdepasse123' }
  });
  assert.equal(connexionAdmin.response.status, 200);
  adminToken = connexionAdmin.donnees.token;

  const produit = await Product.create({ nom: 'Produit CRUD', prix: 10 });
  productId = produit.id;
  productIds.push(produit._id);
  const commande = await Order.create({
    clientId,
    statut: 'livree',
    produits: [{ productId, quantite: 1, prixUnitaire: 10 }]
  });
  orderId = commande.id;
  orderIds.push(commande._id);
});

after(async () => {
  if (clientId) {
    await Review.deleteMany({ clientId });
    await Ticket.deleteMany({ clientId });
  }
  if (orderIds.length) await Order.deleteMany({ _id: { $in: orderIds } });
  if (productIds.length) await Product.deleteMany({ _id: { $in: productIds } });
  if (userIds.length) await User.deleteMany({ _id: { $in: userIds } });
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

test('les CRUD avis et tickets fonctionnent avec MongoDB', async () => {
  let resultat = await requete('/api/reviews', {
    method: 'POST',
    token: clientToken,
    body: { productId, orderId, note: 5, commentaire: 'Avis CRUD.' }
  });
  assert.equal(resultat.response.status, 201);
  const reviewId = resultat.donnees.avis._id;

  resultat = await requete('/api/reviews', {
    method: 'POST',
    token: clientToken,
    body: { productId, orderId, note: 4, commentaire: 'Avis en double.' }
  });
  assert.equal(resultat.response.status, 409);

  resultat = await requete('/api/reviews/mes-avis', { token: clientToken });
  assert.equal(resultat.response.status, 200);
  assert.equal(resultat.donnees.avis.length, 1);

  resultat = await requete(`/api/reviews/produit/${productId}`);
  assert.equal(resultat.response.status, 200);
  assert.equal(resultat.donnees.avis.length, 0);

  resultat = await requete(`/api/reviews/${reviewId}/moderation`, {
    method: 'PATCH',
    token: adminToken,
    body: { statut: 'valide' }
  });
  assert.equal(resultat.response.status, 200);

  resultat = await requete(`/api/reviews/produit/${productId}`);
  assert.equal(resultat.response.status, 200);
  assert.equal(resultat.donnees.avis.length, 1);

  resultat = await requete(`/api/reviews/${reviewId}`, {
    method: 'PATCH',
    token: clientToken,
    body: { note: 4 }
  });
  assert.equal(resultat.response.status, 200);
  let produit = await Product.findById(productId);
  assert.equal(produit.noteMoyenne, 4);
  assert.equal(produit.nombreAvis, 1);

  resultat = await requete(`/api/reviews/${reviewId}`, { method: 'DELETE', token: clientToken });
  assert.equal(resultat.response.status, 200);
  produit = await Product.findById(productId);
  assert.equal(produit.noteMoyenne, 0);
  assert.equal(produit.nombreAvis, 0);

  resultat = await requete('/api/tickets', {
    method: 'POST',
    token: clientToken,
    body: { orderId, sujet: `Test CRUD ${suffixe}`, texte: 'Premier message.' }
  });
  assert.equal(resultat.response.status, 201);
  const ticketId = resultat.donnees.ticket._id;

  resultat = await requete('/api/tickets/mes-tickets', { token: clientToken });
  assert.equal(resultat.response.status, 200);
  assert.equal(resultat.donnees.tickets.length, 1);

  resultat = await requete(`/api/tickets/${ticketId}`, { token: clientToken });
  assert.equal(resultat.response.status, 200);

  resultat = await requete(`/api/tickets/${ticketId}`, { token: otherClientToken });
  assert.equal(resultat.response.status, 404);

  resultat = await requete(`/api/tickets/${ticketId}/messages`, {
    method: 'POST',
    token: clientToken,
    body: { texte: 'Complément client.' }
  });
  assert.equal(resultat.response.status, 201);

  resultat = await requete(`/api/tickets/admin?search=${encodeURIComponent(suffixe)}&page=1&limit=10`, {
    token: adminToken
  });
  assert.equal(resultat.response.status, 200);
  assert.equal(resultat.donnees.tickets.length, 1);

  resultat = await requete(`/api/tickets/admin/${ticketId}`, { token: adminToken });
  assert.equal(resultat.response.status, 200);

  resultat = await requete(`/api/tickets/admin/${ticketId}/messages`, {
    method: 'POST',
    token: adminToken,
    body: { texte: 'Réponse de support.' }
  });
  assert.equal(resultat.response.status, 201);

  resultat = await requete(`/api/tickets/admin/${ticketId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { priorite: 'haute', statut: 'en_cours' }
  });
  assert.equal(resultat.response.status, 200);

  resultat = await requete('/api/tickets/admin/stats', { token: adminToken });
  assert.equal(resultat.response.status, 200);
  assert.equal(typeof resultat.donnees.ticketsOuverts, 'number');

  resultat = await requete(`/api/tickets/admin/${ticketId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { statut: 'ferme' }
  });
  assert.equal(resultat.response.status, 200);

  resultat = await requete(`/api/tickets/${ticketId}/messages`, {
    method: 'POST',
    token: clientToken,
    body: { texte: 'Message interdit.' }
  });
  assert.equal(resultat.response.status, 409);

  resultat = await requete(`/api/tickets/admin/${ticketId}`, {
    method: 'DELETE',
    token: adminToken
  });
  assert.equal(resultat.response.status, 200);
});
