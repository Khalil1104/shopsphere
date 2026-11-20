const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const Zone = require('../models/Zone');
const Courier = require('../models/Courier');
const { AppError } = require('../middlewares/errorHandler');
const {
  ETAPES, LIBELLES, TRANSITIONS, STATUTS_ACTIFS,
  calculerFrais, jourBornes, escapeRegex
} = require('../services/deliveryRules');
const { notifierChangementEtape, alerterRetards } = require('../services/notifications');
const { rechercher } = require('../services/deliverySearch');

const POPULATE = [
  { path: 'courierId', select: 'nom telephone' },
  { path: 'zoneId', select: 'gouvernorat delaiJours' }
];

// POST /api/deliveries (client)
exports.create = async (req, res, next) => {
  try {
    const { orderId, adresse, montantCommande } = req.body;

    // Lien avec le module 3 : on lit la commande si elle existe
    const order = await mongoose.connection.collection('orders').findOne({
      _id: new mongoose.Types.ObjectId(orderId)
    });

    let montant;
    if (order) {
      if (String(order.clientId) !== String(req.user.id)) {
        throw new AppError('Cette commande ne vous appartient pas', 403);
      }
      montant = order.total;
    } else if (montantCommande !== undefined) {
      montant = montantCommande; // mode autonome (tests), à retirer à l'intégration
    } else {
      throw new AppError('Commande introuvable', 404);
    }

    const zone = await Zone.findOne({
      gouvernorat: new RegExp(`^${escapeRegex(adresse.gouvernorat)}$`, 'i'),
      active: true
    });
    if (!zone) throw new AppError('Livraison indisponible pour ce gouvernorat', 404);

    const delivery = await Delivery.create({
      orderId,
      clientId: req.user.id,
      adresse: { ...adresse, gouvernorat: zone.gouvernorat },
      zoneId: zone._id,
      frais: calculerFrais(zone, montant),
      datePrevue: new Date(Date.now() + zone.delaiJours * 86400000),
      historique: [{ statut: 'en_preparation', commentaire: 'Livraison créée' }]
    });

    res.status(201).json({ message: 'Livraison créée', data: delivery });
  } catch (e) {
    if (e.code === 11000) return next(new AppError('Une livraison existe déjà pour cette commande', 409));
    next(e);
  }
};

// GET /api/deliveries/me (client)
exports.mine = async (req, res, next) => {
  try {
    const deliveries = await Delivery.find({ clientId: req.user.id }).sort({ createdAt: -1 }).populate(POPULATE);
    res.status(200).json({ count: deliveries.length, data: deliveries });
  } catch (e) { next(e); }
};

// GET /api/deliveries/:id/suivi (propriétaire ou admin) : ligne de temps
exports.suivi = async (req, res, next) => {
  try {
    const d = await Delivery.findById(req.params.id).populate(POPULATE);
    if (!d) throw new AppError('Livraison introuvable', 404);
    if (req.user.role !== 'admin' && String(d.clientId) !== String(req.user.id)) {
      throw new AppError('Accès refusé', 403);
    }

    const dates = {};
    d.historique.forEach((h) => { dates[h.statut] = h.date; });

    const etapes = ETAPES.map((code) => ({
      code,
      libelle: LIBELLES[code],
      atteinte: Boolean(dates[code]),
      date: dates[code] || null
    }));

    res.status(200).json({
      data: {
        id: d._id,
        orderId: d.orderId,
        statut: d.statut,
        statutLibelle: LIBELLES[d.statut],
        datePrevue: d.datePrevue,
        dateReelle: d.dateReelle,
        frais: d.frais,
        livreur: d.courierId ? { nom: d.courierId.nom, telephone: d.courierId.telephone } : null,
        enRetard: STATUTS_ACTIFS.includes(d.statut) && d.datePrevue < new Date(),
        echec: d.statut === 'echec' ? dates.echec : null,
        etapes
      }
    });
  } catch (e) { next(e); }
};

// GET /api/deliveries (admin) : recherche, filtres, tri, pagination
exports.list = async (req, res, next) => {
  try {
    const r = await rechercher(req.validated.query);
    res.status(200).json({
      count: r.deliveries.length, total: r.total, page: r.page,
      totalPages: r.totalPages,
      data: r.deliveries
    });
  } catch (e) { next(e); }
};

// GET /api/deliveries/:id (admin)
exports.getOne = async (req, res, next) => {
  try {
    const d = await Delivery.findById(req.params.id).populate(POPULATE);
    if (!d) throw new AppError('Livraison introuvable', 404);
    res.status(200).json({ data: d });
  } catch (e) { next(e); }
};

// PATCH /api/deliveries/:id/assign (admin) : limite de livraisons par livreur et par jour
exports.assign = async (req, res, next) => {
  try {
    const d = await Delivery.findById(req.params.id);
    if (!d) throw new AppError('Livraison introuvable', 404);
    if (!STATUTS_ACTIFS.includes(d.statut)) {
      throw new AppError('Cette livraison est terminée, elle ne peut plus être réaffectée', 409);
    }

    const courier = await Courier.findById(req.body.courierId);
    if (!courier) throw new AppError('Livreur introuvable', 404);
    if (!courier.actif) throw new AppError('Ce livreur est inactif', 409);

    const { debut, fin } = jourBornes(d.datePrevue);
    const charge = await Delivery.countDocuments({
      _id: { $ne: d._id },
      courierId: courier._id,
      statut: { $ne: 'echec' },
      datePrevue: { $gte: debut, $lte: fin }
    });
    if (charge >= courier.maxLivraisonsParJour) {
      throw new AppError(
        `Ce livreur a atteint sa limite de ${courier.maxLivraisonsParJour} livraisons pour cette journée`, 409
      );
    }

    d.courierId = courier._id;
    await d.save();
    res.status(200).json({ message: 'Livreur affecté', data: await d.populate(POPULATE) });
  } catch (e) { next(e); }
};

// PATCH /api/deliveries/:id/status (admin) : transitions contrôlées
exports.updateStatus = async (req, res, next) => {
  try {
    const { statut, commentaire } = req.body;
    const d = await Delivery.findById(req.params.id);
    if (!d) throw new AppError('Livraison introuvable', 404);

    if (!TRANSITIONS[d.statut].includes(statut)) {
      const permis = TRANSITIONS[d.statut].map((s) => LIBELLES[s]).join(', ') || 'aucune';
      throw new AppError(`Transition impossible de "${LIBELLES[d.statut]}" vers "${LIBELLES[statut]}". Permises : ${permis}`, 409);
    }
    if (statut === 'expediee' && !d.courierId) {
      throw new AppError("Affectez un livreur avant d'expédier la livraison", 409);
    }

    d.statut = statut;
    if (statut === 'livree') d.dateReelle = new Date();
    d.historique.push({ statut, commentaire: commentaire || '' });
    await d.save();

    notifierChangementEtape(d); // e-mail au client, sans bloquer la réponse

    res.status(200).json({ message: 'Statut mis à jour', data: await d.populate(POPULATE) });
  } catch (e) { next(e); }
};

// GET /api/deliveries/stats/summary (admin)
exports.stats = async (req, res, next) => {
  try {
    const [total, parStatut, delai, enRetard, parGouvernorat] = await Promise.all([
      Delivery.countDocuments(),
      Delivery.aggregate([{ $group: { _id: '$statut', count: { $sum: 1 } } }]),
      Delivery.aggregate([
        { $match: { statut: 'livree', dateReelle: { $ne: null } } },
        { $group: { _id: null, moyenneMs: { $avg: { $subtract: ['$dateReelle', '$createdAt'] } } } }
      ]),
      Delivery.countDocuments({ datePrevue: { $lt: new Date() }, statut: { $in: STATUTS_ACTIFS } }),
      Delivery.aggregate([
        { $group: { _id: '$adresse.gouvernorat', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.status(200).json({
      data: {
        total,
        enRetard,
        delaiMoyenJours: delai[0] ? Number((delai[0].moyenneMs / 86400000).toFixed(2)) : null,
        parStatut: Object.fromEntries(parStatut.map((s) => [s._id, s.count])),
        parGouvernorat: parGouvernorat.map((g) => ({ gouvernorat: g._id, count: g.count }))
      }
    });
  } catch (e) { next(e); }
};

// POST /api/deliveries/jobs/retards (admin) : lance l'alerte manuellement (démo)
exports.runLateAlert = async (req, res, next) => {
  try {
    const n = await alerterRetards();
    res.status(200).json({ message: `${n} livraison(s) en retard signalée(s) aux admins` });
  } catch (e) { next(e); }
};
