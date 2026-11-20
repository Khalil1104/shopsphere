const Zone = require('../models/Zone');
const Courier = require('../models/Courier');
const Delivery = require('../models/Delivery');
const v = require('../validators/livraison');
const ai = require('../services/aiService');
const { STATUTS_ACTIFS } = require('../services/deliveryRules');
const { rechercher } = require('../services/deliverySearch');

// ---------- IA n°1 : recherche en langage naturel ----------
const interpreterIA = async (question, zones, couriers) => {
  const system =
    "Tu convertis la demande en français d'un administrateur de livraisons en filtres de recherche. " +
    'Réponds uniquement par un objet JSON, sans texte autour. Omet les champs non mentionnés.';
  const user =
    `Date du jour : ${new Date().toISOString().slice(0, 10)}\n` +
    'Champs autorisés :\n' +
    '- statut : en_preparation | expediee | en_transit | livree | echec\n' +
    `- gouvernorat : un de [${zones.map((z) => z.gouvernorat).join(', ')}]\n` +
    `- livreur : un de [${couriers.map((c) => c.nom).join(', ')}]\n` +
    '- enRetard : true si la demande parle de retard\n' +
    '- search : mot-clé de ville ou de rue (texte libre)\n' +
    '- from, to : période de création, format YYYY-MM-DD\n' +
    '- sortBy : createdAt | datePrevue | statut ; order : asc | desc\n' +
    `Demande : """${question}"""`;
  return ai.extraireJSON(await ai.askClaude({ system, user, maxTokens: 300 }));
};

// POST /api/deliveries/ai/recherche (admin)
exports.recherche = async (req, res, next) => {
  try {
    const { question } = req.body;
    const [zones, couriers] = await Promise.all([
      Zone.find().select('gouvernorat').lean(),
      Courier.find().select('nom').lean()
    ]);

    let filtres = null;
    let source = 'regles';
    if (ai.isEnabled()) {
      try { filtres = await interpreterIA(question, zones, couriers); source = 'ia'; }
      catch (e) { console.error('[IA] Recherche : repli sur les règles -', e.message); }
    }
    if (!filtres) filtres = ai.interpreterRegles(question, zones, couriers);

    // Nettoyage + correspondance du livreur
    Object.keys(filtres).forEach((k) => {
      if (filtres[k] === null || filtres[k] === '' || filtres[k] === undefined) delete filtres[k];
    });
    const nomLivreur = filtres.livreur;
    delete filtres.livreur;
    if (nomLivreur) {
      const c = couriers.find((x) => x.nom.toLowerCase().includes(String(nomLivreur).toLowerCase()));
      if (c) filtres.courierId = String(c._id);
    }

    // La sortie de l'IA est toujours revalidée par le même schéma que la liste admin
    const { error, value } = v.listQuery.validate({ ...filtres, limit: 20 }, { stripUnknown: true, convert: true });
    const params = error
      ? v.listQuery.validate({ search: String(question).slice(0, 100), limit: 20 }).value
      : value;

    const r = await rechercher(params);

    const appliques = {};
    ['statut', 'gouvernorat', 'enRetard', 'search', 'from', 'to', 'sortBy', 'order'].forEach((k) => {
      if (params[k] !== undefined) appliques[k] = params[k];
    });
    if (params.courierId) {
      const c = couriers.find((x) => String(x._id) === String(params.courierId));
      appliques.livreur = c ? c.nom : String(params.courierId);
    }

    res.status(200).json({ source, question, filtres: appliques, count: r.deliveries.length, total: r.total, data: r.deliveries });
  } catch (e) { next(e); }
};

// ---------- IA n°2 : analyse et recommandations ----------
const collecterIndicateurs = async () => {
  const maintenant = new Date();
  const [total, parStatut, retardsGouv, charge, delais, nonAffectees] = await Promise.all([
    Delivery.countDocuments(),
    Delivery.aggregate([{ $group: { _id: '$statut', count: { $sum: 1 } } }]),
    Delivery.aggregate([
      { $match: { datePrevue: { $lt: maintenant }, statut: { $in: STATUTS_ACTIFS } } },
      { $group: { _id: '$adresse.gouvernorat', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Delivery.aggregate([
      { $match: { statut: { $in: STATUTS_ACTIFS }, courierId: { $ne: null } } },
      { $group: { _id: '$courierId', enCours: { $sum: 1 } } },
      { $lookup: { from: 'couriers', localField: '_id', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $project: { _id: 0, livreur: '$c.nom', enCours: 1, max: '$c.maxLivraisonsParJour' } }
    ]),
    Delivery.aggregate([
      { $match: { statut: 'livree', dateReelle: { $ne: null } } },
      { $group: {
        _id: null,
        reelMs: { $avg: { $subtract: ['$dateReelle', '$createdAt'] } },
        promisMs: { $avg: { $subtract: ['$datePrevue', '$createdAt'] } }
      } }
    ]),
    Delivery.countDocuments({ courierId: null, statut: { $in: STATUTS_ACTIFS } })
  ]);

  const statuts = Object.fromEntries(parStatut.map((s) => [s._id, s.count]));
  const pct = (n) => (total ? Number(((n / total) * 100).toFixed(1)) : 0);
  const jours = (ms) => Number((ms / 86400000).toFixed(2));

  return {
    total,
    parStatut: statuts,
    tauxLivraisonPct: pct(statuts.livree || 0),
    tauxEchecPct: pct(statuts.echec || 0),
    retards: {
      total: retardsGouv.reduce((s, g) => s + g.count, 0),
      parGouvernorat: retardsGouv.map((g) => ({ gouvernorat: g._id, count: g.count }))
    },
    nonAffectees,
    chargeLivreurs: charge,
    delais: {
      reelJours: delais[0] ? jours(delais[0].reelMs) : null,
      promisJours: delais[0] ? jours(delais[0].promisMs) : null
    }
  };
};

const analyserIA = async (indicateurs) => {
  const system =
    'Tu es analyste logistique pour un site e-commerce tunisien. Réponds en français, uniquement par un objet JSON ' +
    'de la forme {"resume": string, "alertes": [{"niveau": "haute|moyenne|info", "message": string}], "recommandations": [string]}. ' +
    'Maximum 4 alertes et 4 recommandations, concrètes. Base-toi uniquement sur les données fournies.';
  const texte = await ai.askClaude({ system, user: JSON.stringify(indicateurs), maxTokens: 700 });
  const a = ai.extraireJSON(texte);
  if (typeof a.resume !== 'string' || !Array.isArray(a.alertes) || !Array.isArray(a.recommandations)) {
    throw new Error('Format de réponse IA inattendu');
  }
  return a;
};

// GET /api/deliveries/ai/analyse (admin) : seules des données agrégées sont envoyées à l'IA
exports.analyse = async (req, res, next) => {
  try {
    const indicateurs = await collecterIndicateurs();
    let analyse = null;
    let source = 'regles';
    if (ai.isEnabled()) {
      try { analyse = await analyserIA(indicateurs); source = 'ia'; }
      catch (e) { console.error('[IA] Analyse : repli sur les règles -', e.message); }
    }
    if (!analyse) analyse = ai.analyseParRegles(indicateurs);
    res.status(200).json({ source, indicateurs, analyse });
  } catch (e) { next(e); }
};
