'use strict';

const AppError = require('../utils/AppError');

/**
 * validate({ body, query, params }) : vérifie la requête avec Joi.
 * Un champ non prévu dans le schéma est refusé (ex. "role": "ADMIN" → 400).
 */
const validate = (schemas) => (req, _res, next) => {
  const errors = [];
  req.validated = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const { value, error } = schemas[part].validate(req[part] ?? {}, { abortEarly: false, errors: { wrap: { label: '' } } });
    if (error) errors.push(...error.details.map((d) => ({ field: d.path.join('.'), message: d.message })));
    else req.validated[part] = value;
  }
  if (errors.length) return next(AppError.badRequest('Données invalides', errors));
  if (req.validated.body) req.body = req.validated.body;
  return next();
};

module.exports = validate;
