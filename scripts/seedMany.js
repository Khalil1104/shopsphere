require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Ticket = require('../models/Ticket');
const { recalculerNoteProduit } = require('../services/reviewService');

const NB_PRODUITS = 8;
const NB_CLIENTS = 30;
const ID_ADMIN = '000000000000000000000002';

// Ids fixes (pour pouvoir tout nettoyer et relancer le script sans doublons)
const hex = (prefix, n) => prefix + n.toString(16).padStart(4, '0').padStart(24 - prefix.length, '0');
const idProduit = (i) => hex('a', i + 1);
const idClient = (i) => hex('b', i + 1);
const idCommande = (i) => hex('c', i + 1);

const alea = (n) => Math.floor(Math.random() * n);
const choisir = (liste) => liste[alea(liste.length)];
const heuresAvant = (h) => new Date(Date.now() - h * 3600 * 1000);

const NOMS = ['Casque audio', 'Clavier mecanique', 'Souris sans fil', 'Ecran 24 pouces',
  'Webcam HD', 'Enceinte Bluetooth', 'Chargeur rapide', 'Sac a dos'];
const COMMENTAIRES_BONS = ['Tres bien', 'Excellent produit', 'Livraison rapide, je recommande',
  'Conforme a la description', 'Parfait', 'Bon rapport qualite prix'];
const COMMENTAIRES_MOYENS = ['Correct', 'Moyen, sans plus', 'Quelques defauts mais utilisable'];
const COMMENTAIRES_MAUVAIS = ['Decevant', 'Produit abime a la reception', 'Ne fonctionne pas bien'];
const COMMENTAIRES_INJURES = ['Vendeur stupide', 'Produit nul', 'Quel escroc'];
const SUJETS = [
  ['Question livraison', 'normale'], ['Colis abime', 'normale'], ['URGENT remboursement', 'haute'],
  ['Produit defectueux', 'normale'], ['Erreur de commande', 'basse'], ['Colis perdu', 'haute'],
  ['Changement adresse', 'basse'], ['Facture manquante', 'basse']
];

(async () => {
  await connectDB();

  const produits = Array.from({ length: NB_PRODUITS }, (_, i) => idProduit(i));
  const clients = Array.from({ length: NB_CLIENTS }, (_, i) => idClient(i));
  const commandes = clients.map((_, i) => idCommande(i));

  // 1. Nettoyage des anciennes donnees de ce script
  await Review.deleteMany({ clientId: { $in: clients } });
  await Ticket.deleteMany({ clientId: { $in: clients } });
  await Order.deleteMany({ _id: { $in: commandes } });
  await Product.deleteMany({ _id: { $in: produits } });

  // 2. Produits
  await Product.insertMany(produits.map((id, i) => ({ _id: id, nom: NOMS[i], prix: 20 + i * 15 })));

  // 3. Une commande livree par client, contenant tous les produits
  await Order.insertMany(clients.map((clientId, i) => ({
    _id: commandes[i],
    clientId,
    statut: 'livree',
    produits: produits.map((productId) => ({ productId, quantite: 1, prixUnitaire: 50 }))
  })));

  // 4. Avis : chaque client note quelques produits (jamais deux fois le meme)
  const avis = [];
  clients.forEach((clientId, ci) => {
    const nb = 2 + alea(3); // 2 a 4 avis par client
    const dejaNotes = new Set();
    while (dejaNotes.size < nb) dejaNotes.add(alea(NB_PRODUITS));
    dejaNotes.forEach((pi) => {
      const tirage = Math.random();
      let note; let commentaire;
      if (tirage < 0.45) { note = 5 - alea(2); commentaire = choisir(COMMENTAIRES_BONS); }
      else if (tirage < 0.70) { note = 3; commentaire = choisir(COMMENTAIRES_MOYENS); }
      else if (tirage < 0.92) { note = 1 + alea(2); commentaire = choisir(COMMENTAIRES_MAUVAIS); }
      else { note = 1; commentaire = choisir(COMMENTAIRES_INJURES); }

      const injurieux = COMMENTAIRES_INJURES.includes(commentaire);
      const statut = injurieux ? 'masque' : choisir(['valide', 'valide', 'valide', 'en_attente', 'masque']);
      avis.push({
        productId: produits[pi], clientId, orderId: commandes[ci],
        note, commentaire, statut
      });
    });
  });
  await Review.insertMany(avis);

  // 5. Recalcul de la note moyenne de chaque produit (avis valides)
  for (const id of produits) await recalculerNoteProduit(id);

  // 6. Tickets : 40 reclamations avec des statuts, priorites et delais varies
  const tickets = [];
  for (let i = 0; i < 40; i++) {
    const ci = alea(NB_CLIENTS);
    const [sujet, priorite] = choisir(SUJETS);
    const ageHeures = 1 + alea(120); // cree il y a 1 a 120 heures
    const debut = heuresAvant(ageHeures);
    const messages = [{ auteurId: clients[ci], auteurRole: 'client', texte: `Bonjour, ${sujet.toLowerCase()}`, createdAt: debut }];
    let statut = 'ouvert';
    let dernierAuteur = 'client';
    let dernierMessage = debut;

    const scenario = Math.random();
    if (scenario > 0.35) {
      // L'admin a repondu apres 1 a 30 heures (sans depasser maintenant)
      const delai = Math.min(1 + alea(30), Math.max(ageHeures - 0.5, 0.5));
      const reponse = new Date(debut.getTime() + delai * 3600 * 1000);
      messages.push({ auteurId: ID_ADMIN, auteurRole: 'admin', texte: 'Nous regardons votre demande.', createdAt: reponse });
      statut = 'en_cours'; dernierAuteur = 'admin'; dernierMessage = reponse;
      const suite = Math.random();
      if (suite > 0.5) statut = 'resolu';
      if (suite > 0.8) statut = 'ferme';
    }
    tickets.push({
      clientId: clients[ci], orderId: commandes[ci], sujet, priorite, statut,
      messages, dernierMessageLe: dernierMessage, dernierAuteurRole: dernierAuteur,
      createdAt: debut, updatedAt: dernierMessage
    });
  }
  await Ticket.insertMany(tickets);

  console.log('Donnees creees :');
  console.log(`- ${produits.length} produits, ${clients.length} clients, ${commandes.length} commandes livrees`);
  console.log(`- ${avis.length} avis`);
  console.log(`- ${tickets.length} tickets`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error('Erreur seedMany :', e.message);
  process.exit(1);
});