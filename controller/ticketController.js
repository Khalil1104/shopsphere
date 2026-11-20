const Joi = require('joi');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const { calculerPriorite, TRANSITIONS } = require('../services/ticketService');

const identifiantSchema = Joi.string().hex().length(24).required().messages({
  'string.hex': 'L’identifiant est invalide.',
  'string.length': 'L’identifiant est invalide.',
  'any.required': 'L’identifiant est obligatoire.'
});
const idParams = Joi.object({ ticketId: identifiantSchema });
const createSchema = Joi.object({
  orderId: identifiantSchema,
  sujet: Joi.string().trim().min(3).max(160).required().messages({
    'string.empty': 'Le sujet est obligatoire.',
    'string.min': 'Le sujet doit contenir au moins 3 caractères.',
    'string.max': 'Le sujet ne peut pas dépasser 160 caractères.',
    'any.required': 'Le sujet est obligatoire.'
  }),
  texte: Joi.string().trim().min(1).max(4000).required().messages({
    'string.empty': 'Le message est obligatoire.',
    'string.max': 'Le message ne peut pas dépasser 4000 caractères.',
    'any.required': 'Le message est obligatoire.'
  })
});
const messageSchema = Joi.object({
  texte: Joi.string().trim().min(1).max(4000).required().messages({
    'string.empty': 'Le message est obligatoire.',
    'string.max': 'Le message ne peut pas dépasser 4000 caractères.',
    'any.required': 'Le message est obligatoire.'
  })
});
const pageSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow(''),
  statut: Joi.string().valid('ouvert', 'en_cours', 'resolu', 'ferme'),
  priorite: Joi.string().valid('basse', 'normale', 'haute'),
  sort: Joi.string().valid('createdAt', 'updatedAt', 'priorite', 'statut').default('updatedAt'),
  order: Joi.string().valid('asc', 'desc').default('desc')
}).messages({ 'any.only': 'Un filtre ou un tri est invalide.' });
const updateSchema = Joi.object({
  priorite: Joi.string().valid('basse', 'normale', 'haute').messages({
    'any.only': 'La priorité doit être basse, normale ou haute.'
  }),
  statut: Joi.string().valid('ouvert', 'en_cours', 'resolu', 'ferme').messages({
    'any.only': 'Le statut du ticket est invalide.'
  })
}).min(1).messages({ 'object.min': 'Indiquez une priorité ou un statut à modifier.' });

function echapperRegex(texte) {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Ouvre un ticket (client). Règle : la priorité est calculée automatiquement.
async function creer(req, res) {
  const { orderId, sujet, texte } = req.validated.body;
  const commande = await Order.findOne({ _id: orderId, clientId: req.user.id });
  if (!commande) {
    return res.status(403).json({ message: 'Cette commande ne vous appartient pas ou est introuvable.' });
  }

  const maintenant = new Date();
  const ticket = await Ticket.create({
    clientId: req.user.id,
    orderId,
    sujet,
    priorite: calculerPriorite(sujet, texte),
    messages: [{ auteurId: req.user.id, auteurRole: 'client', texte }],
    dernierMessageLe: maintenant,
    dernierAuteurRole: 'client'
  });
  return res.status(201).json({ message: 'Ticket créé.', ticket });
}

async function mesTickets(req, res) {
  const { page, limit } = req.validated.query;
  const filtre = { clientId: req.user.id };
  const [tickets, total] = await Promise.all([
    Ticket.find(filtre)
      .select('-messages')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Ticket.countDocuments(filtre)
  ]);
  return res.json({ tickets, pagination: { page, limit, total } });
}

async function voir(req, res) {
  const ticket = await Ticket.findOne({
    _id: req.validated.params.ticketId,
    clientId: req.user.id
  });
  if (!ticket) {
    return res.status(404).json({ message: 'Ticket introuvable.' });
  }
  return res.json({ ticket });
}

// Ajoute un message (client ou admin). Règles : refusé si fermé, changement de statut automatique.
async function ajouterMessage(req, res) {
  const filtre = { _id: req.validated.params.ticketId };
  if (req.user.role === 'client') filtre.clientId = req.user.id;

  const ticket = await Ticket.findOne(filtre);
  if (!ticket) {
    return res.status(404).json({ message: 'Ticket introuvable.' });
  }
  if (ticket.statut === 'ferme') {
    return res.status(409).json({ message: 'Impossible d’ajouter un message à un ticket fermé.' });
  }

  const maintenant = new Date();
  ticket.messages.push({
    auteurId: req.user.id,
    auteurRole: req.user.role,
    texte: req.validated.body.texte,
    createdAt: maintenant
  });
  ticket.dernierMessageLe = maintenant;
  ticket.dernierAuteurRole = req.user.role;
  if (req.user.role === 'client') ticket.rappelEnvoyeLe = null;

  // Règles : un admin qui répond prend en charge le ticket ; un client qui répond à un ticket résolu le rouvre
  if (req.user.role === 'admin' && ticket.statut === 'ouvert') {
    ticket.statut = 'en_cours';
  }
  if (req.user.role === 'client' && ticket.statut === 'resolu') {
    ticket.statut = 'en_cours';
  }

  await ticket.save();
  return res.status(201).json({ message: 'Message ajouté.', ticket });
}

async function listeAdmin(req, res) {
  const { page, limit, search, statut, priorite, sort, order } = req.validated.query;
  const filtre = {};
  if (statut) filtre.statut = statut;
  if (priorite) filtre.priorite = priorite;
  if (search) filtre.sujet = { $regex: echapperRegex(search), $options: 'i' };
  const [tickets, total] = await Promise.all([
    Ticket.find(filtre)
      .select('-messages')
      .populate('clientId', 'nom email')
      .populate('orderId', 'statut')
      .sort({ [sort]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Ticket.countDocuments(filtre)
  ]);
  return res.json({ tickets, pagination: { page, limit, total } });
}

async function detailAdmin(req, res) {
  const ticket = await Ticket.findById(req.validated.params.ticketId)
    .populate('clientId', 'nom email')
    .populate('orderId', 'statut');
  if (!ticket) {
    return res.status(404).json({ message: 'Ticket introuvable.' });
  }
  return res.json({ ticket });
}

// Modifie priorité et statut (admin). Règle : seules les transitions autorisées sont acceptées.
async function modifierAdmin(req, res) {
  const ticket = await Ticket.findById(req.validated.params.ticketId);
  if (!ticket) {
    return res.status(404).json({ message: 'Ticket introuvable.' });
  }

  const { statut, priorite } = req.validated.body;
  if (statut && statut !== ticket.statut) {
    if (!TRANSITIONS[ticket.statut].includes(statut)) {
      return res.status(409).json({
        message: `Impossible de passer de « ${ticket.statut} » à « ${statut} ».`
      });
    }
    ticket.statut = statut;
  }
  if (priorite) ticket.priorite = priorite;

  await ticket.save();
  return res.json({ message: 'Ticket modifié.', ticket });
}

async function supprimerAdmin(req, res) {
  const ticket = await Ticket.findByIdAndDelete(req.validated.params.ticketId);
  if (!ticket) {
    return res.status(404).json({ message: 'Ticket introuvable.' });
  }
  return res.json({ message: 'Ticket supprimé.' });
}

async function statistiques(req, res) {
  const limite = new Date(Date.now() - 48 * 3600 * 1000);
  const [ouverts, delaiReponse, parPriorite, parStatut, sansReponse48h] = await Promise.all([
    Ticket.countDocuments({ statut: { $in: ['ouvert', 'en_cours'] } }),
    Ticket.aggregate([
      { $project: { messages: 1 } },
      { $unwind: '$messages' },
      { $sort: { _id: 1, 'messages.createdAt': 1 } },
      {
        $group: {
          _id: '$_id',
          messages: {
            $push: { role: '$messages.auteurRole', date: '$messages.createdAt' }
          }
        }
      },
      {
        $project: {
          messagesClient: {
            $filter: { input: '$messages', as: 'message', cond: { $eq: ['$$message.role', 'client'] } }
          },
          messagesAdmin: {
            $filter: { input: '$messages', as: 'message', cond: { $eq: ['$$message.role', 'admin'] } }
          }
        }
      },
      {
        $project: {
          debut: { $arrayElemAt: ['$messagesClient.date', 0] },
          reponse: { $arrayElemAt: ['$messagesAdmin.date', 0] }
        }
      },
      { $match: { debut: { $ne: null }, reponse: { $ne: null } } },
      { $project: { delaiMs: { $subtract: ['$reponse', '$debut'] } } },
      { $match: { delaiMs: { $gte: 0 } } },
      {
        $group: {
          _id: null,
          delaiMoyenMs: { $avg: '$delaiMs' },
          ticketsAvecReponse: { $sum: 1 }
        }
      }
    ]),
    Ticket.aggregate([{ $group: { _id: '$priorite', total: { $sum: 1 } } }]),
    Ticket.aggregate([{ $group: { _id: '$statut', total: { $sum: 1 } } }]),
    Ticket.countDocuments({
      statut: { $in: ['ouvert', 'en_cours'] },
      dernierAuteurRole: 'client',
      dernierMessageLe: { $lt: limite }
    })
  ]);
  const delai = delaiReponse[0] || { delaiMoyenMs: null, ticketsAvecReponse: 0 };
  return res.json({
    ticketsOuverts: ouverts,
    delaiMoyenReponseHeures: delai.delaiMoyenMs === null ? null : Math.round((delai.delaiMoyenMs / 3600000) * 100) / 100,
    ticketsAvecReponse: delai.ticketsAvecReponse,
    parPriorite,
    parStatut,
    sansReponse48h
  });
}

module.exports = {
  schemas: { idParams, createSchema, messageSchema, pageSchema, updateSchema },
  creer,
  mesTickets,
  voir,
  ajouterMessage,
  listeAdmin,
  detailAdmin,
  modifierAdmin,
  supprimerAdmin,
  statistiques
};