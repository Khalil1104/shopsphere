const Joi = require('joi');
const { LIBELLES } = require('../services/deliveryRules');

const id = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

// Zones
const zoneCreate = Joi.object({
  gouvernorat: Joi.string().trim().min(2).max(50).required().label('gouvernorat'),
  frais: Joi.number().min(0).required().label('frais'),
  delaiJours: Joi.number().integer().min(1).max(30).required().label('délai'),
  seuilGratuit: Joi.number().min(0).allow(null).label('seuil de gratuité'),
  active: Joi.boolean().label('active')
});
const zoneUpdate = zoneCreate
  .fork(['gouvernorat', 'frais', 'delaiJours'], (s) => s.optional())
  .min(1);

const fraisQuery = Joi.object({
  gouvernorat: Joi.string().trim().required().label('gouvernorat'),
  montant: Joi.number().min(0).required().label('montant')
});

// Livreurs
const courierCreate = Joi.object({
  nom: Joi.string().trim().min(2).max(80).required().label('nom'),
  telephone: Joi.string().pattern(/^\d{8}$/).required().label('téléphone (8 chiffres)'),
  maxLivraisonsParJour: Joi.number().integer().min(1).max(50).label('limite par jour'),
  actif: Joi.boolean().label('actif')
});
const courierUpdate = courierCreate.fork(['nom', 'telephone'], (s) => s.optional()).min(1);

// Livraisons
const deliveryCreate = Joi.object({
  orderId: id.required().label('orderId'),
  adresse: Joi.object({
    rue: Joi.string().trim().min(3).max(150).required().label('rue'),
    ville: Joi.string().trim().min(2).max(80).required().label('ville'),
    gouvernorat: Joi.string().trim().required().label('gouvernorat'),
    codePostal: Joi.string().pattern(/^\d{4}$/).required().label('code postal')
  }).required().label('adresse'),
  montantCommande: Joi.number().min(0).label('montant de la commande')
});

const assignSchema = Joi.object({ courierId: id.required().label('courierId') });

const statusSchema = Joi.object({
  statut: Joi.string().valid(...Object.keys(LIBELLES)).required().label('statut'),
  commentaire: Joi.string().trim().max(200).allow('').label('commentaire')
});

const listQuery = Joi.object({
  search: Joi.string().trim().max(100),
  statut: Joi.string().valid(...Object.keys(LIBELLES)),
  gouvernorat: Joi.string().trim(),
  courierId: id,
  enRetard: Joi.boolean(),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'datePrevue', 'statut').default('createdAt'),
  order: Joi.string().valid('asc', 'desc').default('desc')
});

const aiSearch = Joi.object({
  question: Joi.string().trim().min(3).max(300).required().label('question')
});

module.exports = {
  zoneCreate, zoneUpdate, fraisQuery,
  courierCreate, courierUpdate,
  deliveryCreate, assignSchema, statusSchema, listQuery, aiSearch
};
