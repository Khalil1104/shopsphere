const Zone = require('../models/Zone');
const Delivery = require('../models/Delivery');
const { AppError } = require('../middlewares/errorHandler');
const { calculerFrais, escapeRegex } = require('../services/deliveryRules');

exports.list = async (req, res, next) => {
  try {
    const zones = await Zone.find().sort({ gouvernorat: 1 });
    res.status(200).json({ count: zones.length, data: zones });
  } catch (e) { next(e); }
};

// GET /api/zones/frais?gouvernorat=Tunis&montant=80
exports.frais = async (req, res, next) => {
  try {
    const { gouvernorat, montant } = req.validated.query;
    const zone = await Zone.findOne({
      gouvernorat: new RegExp(`^${escapeRegex(gouvernorat)}$`, 'i'),
      active: true
    });
    if (!zone) throw new AppError('Livraison indisponible pour ce gouvernorat', 404);

    const frais = calculerFrais(zone, montant);
    res.status(200).json({
      data: { gouvernorat: zone.gouvernorat, frais, gratuite: frais === 0, delaiJours: zone.delaiJours }
    });
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const zone = await Zone.create(req.body);
    res.status(201).json({ message: 'Zone créée', data: zone });
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const zone = await Zone.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!zone) throw new AppError('Zone introuvable', 404);
    res.status(200).json({ message: 'Zone modifiée', data: zone });
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    if (await Delivery.exists({ zoneId: req.params.id })) {
      throw new AppError('Impossible de supprimer une zone utilisée par des livraisons', 409);
    }
    const zone = await Zone.findByIdAndDelete(req.params.id);
    if (!zone) throw new AppError('Zone introuvable', 404);
    res.status(200).json({ message: 'Zone supprimée', data: zone });
  } catch (e) { next(e); }
};
