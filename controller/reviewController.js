const Joi = require('joi');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { recalculerNoteProduit } = require('../services/reviewService');
const { contientMotInterdit } = require('../services/moderationService');

const identifiantSchema = Joi.string().hex().length(24).required().messages({
  'string.hex': 'L’identifiant est invalide.',
  'string.length': 'L’identifiant est invalide.',
  'any.required': 'L’identifiant est obligatoire.'
});
const idParams = Joi.object({ reviewId: identifiantSchema });
const productParams = Joi.object({ productId: identifiantSchema });
const createSchema = Joi.object({
  productId: identifiantSchema,
  orderId: identifiantSchema,
  note: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'La note doit être un nombre.',
    'number.integer': 'La note doit être un nombre entier.',
    'number.min': 'La note doit être comprise entre 1 et 5.',
    'number.max': 'La note doit être comprise entre 1 et 5.',
    'any.required': 'La note est obligatoire.'
  }),
  commentaire: Joi.string().trim().min(1).max(2000).required().messages({
    'string.empty': 'Le commentaire est obligatoire.',
    'string.max': 'Le commentaire ne peut pas dépasser 2000 caractères.',
    'any.required': 'Le commentaire est obligatoire.'
  })
}).messages({ 'object.unknown': 'Un champ fourni est inconnu.' });
const updateSchema = Joi.object({
  note: Joi.number().integer().min(1).max(5).messages({
    'number.integer': 'La note doit être un nombre entier.',
    'number.min': 'La note doit être comprise entre 1 et 5.',
    'number.max': 'La note doit être comprise entre 1 et 5.'
  }),
  commentaire: Joi.string().trim().min(1).max(2000).messages({
    'string.empty': 'Le commentaire ne peut pas être vide.',
    'string.max': 'Le commentaire ne peut pas dépasser 2000 caractères.'
  })
}).min(1).messages({ 'object.min': 'Indiquez au moins un champ à modifier.' });
const pageSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});
const adminQuerySchema = pageSchema.append({
  search: Joi.string().trim().max(100).allow(''),
  statut: Joi.string().valid('en_attente', 'valide', 'masque'),
  note: Joi.number().integer().min(1).max(5),
  productId: Joi.string().hex().length(24),
  sort: Joi.string().valid('createdAt', 'note', 'updatedAt').default('createdAt'),
  order: Joi.string().valid('asc', 'desc').default('desc')
}).messages({
  'number.min': 'La valeur doit être supérieure ou égale à 1.',
  'number.max': 'La limite ne peut pas dépasser 100.',
  'any.only': 'La valeur de filtre ou de tri est invalide.'
});
const moderationSchema = Joi.object({
  statut: Joi.string().valid('valide', 'masque').required().messages({
    'any.only': 'Le statut doit être valide ou masqué.',
    'any.required': 'Le statut est obligatoire.'
  })
});

function echapperRegex(texte) {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Crée un avis (client). Règles : produit livré obligatoire, injures masquées automatiquement.
async function creer(req, res) {
  const { productId, orderId, note, commentaire } = req.validated.body;
  const commande = await Order.findOne({
    _id: orderId,
    clientId: req.user.id,
    statut: 'livree',
    'produits.productId': productId
  });
  if (!commande) {
    return res.status(403).json({ message: 'Seul l’acheteur d’un produit livré peut déposer un avis.' });
  }

  const injurieux = contientMotInterdit(commentaire);
  const avis = await Review.create({
    productId,
    clientId: req.user.id,
    orderId,
    note,
    commentaire,
    statut: injurieux ? 'masque' : 'en_attente'
  });
  return res.status(201).json({
    message: injurieux
      ? 'Avis bloqué automatiquement : langage inapproprié.'
      : 'Avis envoyé pour modération.',
    avis
  });
}

async function mesAvis(req, res) {
  const { page, limit } = req.validated.query;
  const filtre = { clientId: req.user.id };
  const [avis, total] = await Promise.all([
    Review.find(filtre)
      .populate('productId', 'nom')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Review.countDocuments(filtre)
  ]);
  return res.json({ avis, pagination: { page, limit, total } });
}

async function avisPublics(req, res) {
  const { productId } = req.validated.params;
  const { page, limit } = req.validated.query;
  const filtre = { productId, statut: 'valide' };
  const [avis, total] = await Promise.all([
    Review.find(filtre)
      .select('note commentaire createdAt clientId')
      .populate('clientId', 'nom')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Review.countDocuments(filtre)
  ]);
  return res.json({ avis, pagination: { page, limit, total } });
}

// Modifie son avis (client). Règle : l'avis modifié repasse en modération.
async function modifier(req, res) {
  const { reviewId } = req.validated.params;
  const avis = await Review.findOne({ _id: reviewId, clientId: req.user.id });
  if (!avis) {
    return res.status(404).json({ message: 'Avis introuvable.' });
  }

  const etaitValide = avis.statut === 'valide';
  Object.assign(avis, req.validated.body);
  avis.statut = contientMotInterdit(avis.commentaire) ? 'masque' : 'en_attente';
  await avis.save();

  // La note du produit ne compte que les avis validés : on la recalcule
  if (etaitValide) {
    await recalculerNoteProduit(avis.productId);
  }
  return res.json({ message: 'Avis modifié, en attente de nouvelle modération.', avis });
}

async function supprimer(req, res) {
  const avis = await Review.findOneAndDelete({
    _id: req.validated.params.reviewId,
    clientId: req.user.id
  });
  if (!avis) {
    return res.status(404).json({ message: 'Avis introuvable.' });
  }
  if (avis.statut === 'valide') {
    await recalculerNoteProduit(avis.productId);
  }
  return res.json({ message: 'Avis supprimé.' });
}

async function listeAdmin(req, res) {
  const { page, limit, search, statut, note, productId, sort, order } = req.validated.query;
  const filtre = {};
  if (statut) filtre.statut = statut;
  if (note) filtre.note = note;
  if (productId) filtre.productId = productId;
  if (search) filtre.commentaire = { $regex: echapperRegex(search), $options: 'i' };

  const [avis, total] = await Promise.all([
    Review.find(filtre)
      .populate('clientId', 'nom email')
      .populate('productId', 'nom')
      .populate('orderId', 'statut')
      .sort({ [sort]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Review.countDocuments(filtre)
  ]);
  return res.json({ avis, pagination: { page, limit, total } });
}

async function moderer(req, res) {
  const { reviewId } = req.validated.params;
  const { statut } = req.validated.body;
  const avis = await Review.findByIdAndUpdate(
    reviewId,
    { $set: { statut } },
    { new: true, runValidators: true }
  );
  if (!avis) {
    return res.status(404).json({ message: 'Avis introuvable.' });
  }
  await recalculerNoteProduit(avis.productId);
  return res.json({ message: 'Modération enregistrée.', avis });
}

async function statistiques(req, res) {
  const [parProduit, parStatut] = await Promise.all([
    Review.aggregate([
      { $match: { statut: 'valide' } },
      {
        $group: {
          _id: '$productId',
          noteMoyenne: { $avg: '$note' },
          nombreAvis: { $sum: 1 }
        }
      },
      { $lookup: { from: Product.collection.name, localField: '_id', foreignField: '_id', as: 'produit' } },
      { $unwind: { path: '$produit', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          nomProduit: '$produit.nom',
          noteMoyenne: { $round: ['$noteMoyenne', 2] },
          nombreAvis: 1
        }
      },
      { $sort: { nomProduit: 1 } }
    ]),
    Review.aggregate([{ $group: { _id: '$statut', total: { $sum: 1 } } }])
  ]);
  return res.json({ parProduit, parStatut });
}

// Résumé public des notes d'un produit : moyenne, total et répartition par étoile
async function resumeProduit(req, res) {
  const { productId } = req.validated.params;
  const lignes = await Review.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId), statut: 'valide' } },
    { $group: { _id: '$note', total: { $sum: 1 } } }
  ]);

  const repartition = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let somme = 0;
  lignes.forEach((l) => {
    repartition[l._id] = l.total;
    total += l.total;
    somme += l._id * l.total;
  });

  return res.json({
    productId,
    nombreAvis: total,
    noteMoyenne: total ? Math.round((somme / total) * 100) / 100 : 0,
    repartition
  });
}

module.exports = {
  schemas: { idParams, productParams, createSchema, updateSchema, pageSchema, adminQuerySchema, moderationSchema },
  creer,
  mesAvis,
  avisPublics,
  modifier,
  supprimer,
  listeAdmin,
  moderer,
  statistiques,
  resumeProduit
};