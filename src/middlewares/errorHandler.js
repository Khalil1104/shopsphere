'use strict';

const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

const notFound = (req, _res, next) => next(AppError.notFound(`Route introuvable : ${req.method} ${req.path}`));

/** Toutes les erreurs passent ici et sortent au même format : { code, message, details? } */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let error = err;
  if (!(error instanceof AppError)) {
    if (err.type === 'entity.parse.failed') error = AppError.badRequest('JSON invalide');
    else if (err instanceof mongoose.Error.ValidationError) {
      error = AppError.badRequest('Données invalides', Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })));
    } else if (err instanceof mongoose.Error.CastError) error = AppError.badRequest('Identifiant invalide');
    else if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      error = AppError.conflict(field === 'cin' ? 'Ce CIN est déjà utilisé' : 'Cette adresse e-mail est déjà utilisée');
    }
  }

  if (error instanceof AppError) {
    const body = { code: error.code, message: error.message };
    if (error.details) body.details = error.details;
    return res.status(error.status).json(body);
  }

  console.error(err); // erreur imprévue : détail dans la console, jamais envoyé au client
  return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' });
}

module.exports = { notFound, errorHandler };
