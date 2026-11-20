const MESSAGES = {
  'any.required': '{{#label}} est obligatoire',
  'string.empty': '{{#label}} ne doit pas être vide',
  'string.base': '{{#label}} doit être du texte',
  'string.min': '{{#label}} est trop court',
  'string.max': '{{#label}} est trop long',
  'string.pattern.base': '{{#label}} est invalide',
  'number.base': '{{#label}} doit être un nombre',
  'number.min': '{{#label}} est trop petit',
  'number.max': '{{#label}} est trop grand',
  'number.integer': '{{#label}} doit être un entier',
  'boolean.base': '{{#label}} doit être vrai ou faux',
  'date.base': '{{#label}} doit être une date valide',
  'any.only': '{{#label}} a une valeur non autorisée',
  'object.min': 'Fournissez au moins un champ à modifier'
};

const validate = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
    messages: MESSAGES
  });
  if (error) {
    return res.status(400).json({ message: error.details.map((d) => d.message).join(', ') });
  }
  // Express 5 rend req.query en lecture seule : on ne remplace que le body
  if (source === 'body') req.body = value;
  else req.validated = { ...(req.validated || {}), [source]: value };
  next();
};

module.exports = validate;
