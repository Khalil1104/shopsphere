module.exports = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });

  if (error) {
    return res.status(400).json({
      message: 'Les données fournies sont invalides.'
    });
  }
  req.validated = req.validated || {};
  req.validated[source] = value;
  return next();
};
