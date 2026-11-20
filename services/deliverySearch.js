const Delivery = require('../models/Delivery');
const { STATUTS_ACTIFS, escapeRegex } = require('./deliveryRules');

const POPULATE = [
  { path: 'courierId', select: 'nom telephone' },
  { path: 'zoneId', select: 'gouvernorat delaiJours' }
];

// Recherche + filtres + tri + pagination (utilisé par la liste admin et la recherche IA)
const rechercher = async ({
  search, statut, gouvernorat, courierId, enRetard, from, to,
  page = 1, limit = 10, sortBy = 'createdAt', order = 'desc'
}) => {
  const filter = {};

  if (statut) filter.statut = statut;
  if (gouvernorat) filter['adresse.gouvernorat'] = gouvernorat;
  if (courierId) filter.courierId = courierId;
  if (enRetard) {
    filter.datePrevue = { $lt: new Date() };
    // Une livraison en retard est forcément encore active
    filter.statut = statut ? (STATUTS_ACTIFS.includes(statut) ? statut : '__aucun__') : { $in: STATUTS_ACTIFS };
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ 'adresse.ville': regex }, { 'adresse.rue': regex }];
    if (/^[0-9a-fA-F]{24}$/.test(search)) filter.$or.push({ orderId: search });
  }

  const [deliveries, total] = await Promise.all([
    Delivery.find(filter)
      .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(POPULATE),
    Delivery.countDocuments(filter)
  ]);

  return { deliveries, total, page, totalPages: Math.ceil(total / limit) };
};

module.exports = { rechercher };
