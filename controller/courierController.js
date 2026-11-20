const Courier = require('../models/Courier');
const Delivery = require('../models/Delivery');
const { AppError } = require('../middlewares/errorHandler');
const { STATUTS_ACTIFS } = require('../services/deliveryRules');

exports.list = async (req, res, next) => {
  try {
    const couriers = await Courier.find().sort({ nom: 1 });
    res.status(200).json({ count: couriers.length, data: couriers });
  } catch (e) { next(e); }
};

exports.getOne = async (req, res, next) => {
  try {
    const courier = await Courier.findById(req.params.id);
    if (!courier) throw new AppError('Livreur introuvable', 404);
    res.status(200).json({ data: courier });
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const courier = await Courier.create(req.body);
    res.status(201).json({ message: 'Livreur créé', data: courier });
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const courier = await Courier.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!courier) throw new AppError('Livreur introuvable', 404);
    res.status(200).json({ message: 'Livreur modifié', data: courier });
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    if (await Delivery.exists({ courierId: req.params.id, statut: { $in: STATUTS_ACTIFS } })) {
      throw new AppError('Ce livreur a encore des livraisons en cours', 409);
    }
    const courier = await Courier.findByIdAndDelete(req.params.id);
    if (!courier) throw new AppError('Livreur introuvable', 404);
    res.status(200).json({ message: 'Livreur supprimé', data: courier });
  } catch (e) { next(e); }
};
